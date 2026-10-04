import type { AnalysisConfig, AnalysisOutcome, EquationGroup, LinearEquation, VarRef } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import type { LabeledMatrix } from '@/domain/topology/types'
import { METHOD_WHY, WHY } from '@/engine/explanations'
import { matVec, multiply, transpose } from '@/engine/numerical'
import { reducedIncidenceMatrix } from '@/engine/topology'
import {
  addIdentificationSteps,
  branchDiagonalMatrix,
  finalize,
  label,
  makeEquation,
  preflight,
  solveOrFail,
  sourceVectorTable,
  StepBuilder,
  systemFromEquations,
  systemMatrix,
} from '../common/framework'
import { branchModels, matrixLatex, refToken, varVn, varXi } from '../common/model'

/**
 * Nodal analysis with the generalised branch model (§17.4, §17.11.1):
 *   A Yp Aᵀ vₙ = A (i_g − Yp v_g)
 * Ideal voltage sources are handled by augmentation (see MATHEMATICS.md §5).
 */
export function solveNodal(net: Network, config: AnalysisConfig): AnalysisOutcome {
  const method = 'nodal' as const
  const prepared = preflight(net, method, config)
  if ('ok' in prepared) return prepared
  const ref = prepared.referenceNodeId!
  const sb = new StepBuilder()
  addIdentificationSteps(sb, net)
  sb.add('reference', 'Select reference node', `Reference node: ${label(net, ref)}.`, [{ type: 'latex', latex: 'v_{n,\\mathrm{ref}} = 0' }], WHY.reference)
  sb.add('topology', 'Construct topology', 'Nodal analysis needs only the reduced incidence matrix; no tree is required (§17.4).', [
    { type: 'text', text: METHOD_WHY.nodal },
  ])

  const A = reducedIncidenceMatrix(net, ref)
  sb.add('matrix', 'Construct incidence matrix A', `A is ${A.rows.length}×${A.cols.length}.`, [{ type: 'matrix', matrixId: 'A' }], WHY.incidenceEntry)

  const models = branchModels(net)
  const b = net.branches.length
  const Ypm = branchDiagonalMatrix(net, 'Y', models)
  const Yp = Ypm.data
  const At = transpose(A.data, b)
  const Yn = multiply(multiply(A.data, Yp), At, { aCols: b, bCols: A.data.length })
  const ig = models.map((m) => m.ig)
  const vg = models.map((m) => m.vg)
  const rhs = matVec(A.data, ig.map((x, k) => x - Yp[k][k] * vg[k]))

  const nodeRows = net.nodes.filter((n) => n.id !== ref)
  const vn = nodeRows.map((n) => varVn(net, n.id))
  const vSources = models.filter((m) => m.idealV)
  const xs = vSources.map((m) => varXi(m.branch))

  const YnMatrix: LabeledMatrix = {
    id: 'Yn',
    symbol: 'Y_n',
    title: 'Nodal admittance matrix',
    description: 'Yₙ = A Yₚ Aᵀ. Diagonal: sum of admittances at the node. Off-diagonal: minus the sum of admittances between the two nodes (§17.4).',
    kind: 'node-admittance',
    rows: A.rows,
    cols: A.rows.map((r) => ({ ...r })),
    data: Yn,
  }

  const nodalEqs: LinearEquation[] = nodeRows.map((n, r) =>
    makeEquation(
      net,
      `node-${r}`,
      [...vn.map((u, j) => ({ coef: Yn[r][j], v: u })), ...vSources.map((m, q) => ({ coef: A.data[r][m.col], v: xs[q] }))],
      rhs[r],
      `KCL at node ${n.label} with iₖ = yₖ(vₖ + v_gk) − i_gk and v = Aᵀvₙ.`,
      refToken.node(net, n.id),
    ),
  )
  const constraintEqs: LinearEquation[] = vSources.map((m) =>
    makeEquation(
      net,
      `vs-${m.branch.index}`,
      vn.map((u, j) => ({ coef: A.data[j][m.col], v: u })),
      m.knownV as number,
      `Ideal voltage source ${m.branch.elementLabel}: v${m.branch.index} = vₙ(${label(net, m.branch.fromNode)}) − vₙ(${label(net, m.branch.toNode)}) = ${m.branch.polarity > 0 ? '+' : '−'}E.`,
      refToken.branch(m.branch),
    ),
  )

  const groups: EquationGroup[] = [
    {
      id: 'nodal',
      title: 'Nodal equations',
      matrixForm: vSources.length ? 'A Y_p A^{T} v_n + A_V\\, i_V = A\\left(i_g - Y_p v_g\\right)' : 'A Y_p A^{T} v_n = A\\left(i_g - Y_p v_g\\right)',
      description: WHY.kclA + ' ' + METHOD_WHY.nodal,
      equations: nodalEqs,
    },
  ]
  if (vSources.length) {
    groups.push({ id: 'vs', title: 'Ideal voltage-source constraints', matrixForm: 'A_V^{T} v_n = v_V', description: WHY.idealSourcesNodal, equations: constraintEqs })
  }

  sb.add(
    'equations',
    'Generate nodal equations',
    `Substitute the element relations into A i = 0 with v = Aᵀvₙ.`,
    [
      { type: 'latex', latex: 'A\\,i = 0,\\quad v = A^{T}v_n,\\quad i = Y_p(v + v_g) - i_g', display: true },
      { type: 'latex', latex: '\\Rightarrow\\ A Y_p A^{T} v_n = A\\left(i_g - Y_p v_g\\right)', display: true },
    ],
    WHY.nodeTransformation,
  )
  sb.add(
    'elements',
    'Insert component equations',
    `Branch admittances form Yₚ; sources enter through v_g and i_g. Yₙ = A Yₚ Aᵀ is ${Yn.length}×${Yn.length}.`,
    [
      sourceVectorTable(models),
      { type: 'matrix', matrixId: 'Yp' },
      { type: 'matrix', matrixId: 'Yn' },
      { type: 'latex', latex: `A\\left(i_g - Y_p v_g\\right) = ${matrixLatex(rhs.map((x) => [x]))}`, display: true },
      ...(vSources.length ? [{ type: 'text' as const, text: WHY.idealSourcesNodal }] : []),
      { type: 'equations', groupId: 'nodal' },
      ...(vSources.length ? [{ type: 'equations' as const, groupId: 'vs' }] : []),
    ],
    WHY.elementRelations,
  )

  const unknowns: VarRef[] = [...vn, ...xs]
  const equations = [...nodalEqs, ...constraintEqs]
  const { M, r } = systemFromEquations(equations, unknowns)
  const matrices: LabeledMatrix[] = [A, Ypm, YnMatrix]
  if (vSources.length) matrices.push(systemMatrix(net, 'M', 'Augmented nodal system', M, r, equations, unknowns))
  sb.add('solve', 'Solve', `${unknowns.length} unknowns: ${unknowns.map((u) => u.text).join(', ')}.`, vSources.length ? [{ type: 'matrix', matrixId: 'M' }] : [], WHY.solve)

  const solved = solveOrFail(method, M, r, unknowns, sb, matrices)
  if (solved.ok === false) return solved
  const nv = vn.length
  const nodeVoltages: Record<string, number> = { [ref]: 0 }
  nodeRows.forEach((n, j) => (nodeVoltages[n.id] = solved.x[j]))
  const v = matVec(At, solved.x.slice(0, nv))
  const i = models.map((m, k) => {
    if (m.idealV) return solved.x[nv + vSources.indexOf(m)]
    if (m.idealI) return m.knownI as number
    return (m.y as number) * (v[k] + m.vg) - m.ig
  })
  sb.steps[sb.steps.length - 1].blocks.push({ type: 'latex', latex: `v_n = ${matrixLatex(solved.x.slice(0, nv).map((x) => [x]))}\\ \\mathrm{V}`, display: true })

  return finalize({
    method,
    net,
    prepared,
    sb,
    matrices,
    equationGroups: groups,
    unknowns,
    solve: solved,
    primary: vn.map((u, j) => ({ v: u, value: solved.x[j] })),
    v,
    i,
    nodeVoltages,
    models,
  })
}
