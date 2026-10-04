import type { AnalysisConfig, AnalysisOutcome, EquationGroup, LinearEquation, VarRef } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import type { LabeledMatrix } from '@/domain/topology/types'
import { METHOD_WHY, WHY } from '@/engine/explanations'
import { matVec, multiply, transpose } from '@/engine/numerical'
import { fundamentalCutSetMatrix, fundamentalCutSets } from '@/engine/topology'
import {
  addIdentificationSteps,
  branchDiagonalMatrix,
  elementEquations,
  finalize,
  makeEquation,
  preflight,
  solveOrFail,
  sourceVectorTable,
  StepBuilder,
  systemFromEquations,
  systemMatrix,
} from '../common/framework'
import { branchModels, matrixLatex, refToken, varI, varV, varVt, varXi } from '../common/model'
import { addCutSetStep, addTreeStep } from '../common/treeSteps'

/**
 * Node-pair analysis with the generalised branch model (§17.10, §17.11.3):
 *   Qf Yp Qfᵀ vₜ = Qf (i_g − Yp v_g)
 * Ideal voltage sources are handled by augmentation (MATHEMATICS.md §5).
 */
export function solveNodePair(net: Network, config: AnalysisConfig): AnalysisOutcome {
  const method = 'nodePair' as const
  const prepared = preflight(net, method, config)
  if ('ok' in prepared) return prepared
  const tree = prepared.tree!
  const sb = new StepBuilder()
  addIdentificationSteps(sb, net)
  addTreeStep(sb, net, tree)
  const cutsets = fundamentalCutSets(net, tree)
  prepared.treeInfo!.fundamentalCutSets = cutsets
  addCutSetStep(sb, net, cutsets)
  const Qf = fundamentalCutSetMatrix(net, tree, cutsets)
  sb.add('matrix', 'Construct fundamental cut-set matrix Qf', `Qf is ${Qf.rows.length}×${Qf.cols.length}.`, [{ type: 'matrix', matrixId: 'Qf' }], WHY.fcutset)

  const models = branchModels(net)
  const b = net.branches.length
  const Ypm = branchDiagonalMatrix(net, 'Y', models)
  const Yp = Ypm.data
  const QfT = transpose(Qf.data, b)
  const Yt = multiply(multiply(Qf.data, Yp), QfT, { aCols: b, bCols: Qf.data.length })
  const rhs = matVec(Qf.data, models.map((m, k) => m.ig - Yp[k][k] * m.vg))

  const twigs = Qf.rows.map((r) => net.branches.find((x) => x.id === r.refId)!)
  const vt = twigs.map(varVt)
  const vSources = models.filter((m) => m.idealV)
  const xs = vSources.map((m) => varXi(m.branch))

  const Ytm: LabeledMatrix = {
    id: 'Yt',
    symbol: 'Y_t',
    title: 'Node-pair admittance matrix',
    description: 'Yₜ = Qf Yₚ Qfᵀ. Diagonal: sum of admittances in the f-cut-set. Off-diagonal: ± sum of admittances common to two f-cut-sets (+ if oriented alike) (§17.10).',
    kind: 'node-pair-admittance',
    rows: Qf.rows,
    cols: Qf.rows.map((r) => ({ ...r })),
    data: Yt,
  }

  const npEqs: LinearEquation[] = twigs.map((t, r) =>
    makeEquation(
      net,
      `np-${r}`,
      [...vt.map((u, j) => ({ coef: Yt[r][j], v: u })), ...vSources.map((m, q) => ({ coef: Qf.data[r][m.col], v: xs[q] }))],
      rhs[r],
      `KCL for the f-cut-set of twig ${t.label} with iₖ = yₖ(vₖ + v_gk) − i_gk and v = Qfᵀvₜ.`,
      refToken.twig(t),
    ),
  )
  const constraintEqs: LinearEquation[] = vSources.map((m) =>
    makeEquation(
      net,
      `vs-${m.branch.index}`,
      vt.map((u, j) => ({ coef: Qf.data[j][m.col], v: u })),
      m.knownV as number,
      `Ideal voltage source ${m.branch.elementLabel}: v${m.branch.index} = (Qfᵀvₜ)${m.branch.index} = ${m.branch.polarity > 0 ? '+' : '−'}E.`,
      refToken.branch(m.branch),
    ),
  )
  const kclRows: LinearEquation[] = twigs.map((t, r) =>
    makeEquation(net, `kcl-${r}`, net.branches.map((br, k) => ({ coef: Qf.data[r][k], v: varI(br) })), 0, `KCL, f-cut-set of ${t.label}.`, refToken.twig(t)),
  )
  const tvRows: LinearEquation[] = net.branches.map((br, k) =>
    makeEquation(net, `tv-${k}`, [{ coef: 1, v: varV(br) }, ...vt.map((u, j) => ({ coef: -QfT[k][j], v: u }))], 0, `${br.label} voltage from twig voltages.`, refToken.branch(br)),
  )

  const groups: EquationGroup[] = [
    { id: 'kcl', title: 'KCL — f-cut-set form', matrixForm: 'Q_f\\,i = 0', description: WHY.kclQf, equations: kclRows },
    { id: 'tv', title: 'Twig-voltage relations', matrixForm: 'v = Q_f^{T} v_t', description: WHY.twigVoltages, equations: tvRows },
    { id: 'element', title: 'Element relations', matrixForm: 'i_k = y_k(v_k + v_{gk}) - i_{gk}', description: WHY.elementRelations, equations: elementEquations(net, models, { v: (k) => varV(net.branches[k]), i: (k) => varI(net.branches[k]) }) },
    {
      id: 'nodepair',
      title: 'Node-pair equations',
      matrixForm: vSources.length ? 'Q_f Y_p Q_f^{T} v_t + Q_V\\, i_V = Q_f\\left(i_g - Y_p v_g\\right)' : 'Q_f Y_p Q_f^{T} v_t = Q_f\\left(i_g - Y_p v_g\\right)',
      description: METHOD_WHY.nodePair,
      equations: npEqs,
    },
  ]
  if (vSources.length) groups.push({ id: 'vs', title: 'Ideal voltage-source constraints', matrixForm: 'Q_V^{T} v_t = v_V', description: WHY.idealSourcesNodal, equations: constraintEqs })

  sb.add(
    'equations',
    'Generate node-pair equations',
    'Substitute the element relations and v = Qfᵀvₜ into Qf i = 0.',
    [
      { type: 'latex', latex: 'Q_f\\,i = 0,\\quad v = Q_f^{T} v_t,\\quad i = Y_p(v + v_g) - i_g', display: true },
      { type: 'latex', latex: '\\Rightarrow\\ Q_f Y_p Q_f^{T} v_t = Q_f\\left(i_g - Y_p v_g\\right)', display: true },
      { type: 'equations', groupId: 'kcl' },
    ],
    WHY.kclQf,
  )
  sb.add(
    'elements',
    'Insert component equations',
    `Branch admittances form Yₚ; Yₜ = Qf Yₚ Qfᵀ is ${Yt.length}×${Yt.length}.`,
    [
      sourceVectorTable(models),
      { type: 'matrix', matrixId: 'Yp' },
      { type: 'matrix', matrixId: 'Yt' },
      { type: 'latex', latex: `Q_f\\left(i_g - Y_p v_g\\right) = ${matrixLatex(rhs.map((x) => [x]))}`, display: true },
      ...(vSources.length ? [{ type: 'text' as const, text: WHY.idealSourcesNodal }] : []),
      { type: 'equations', groupId: 'nodepair' },
      ...(vSources.length ? [{ type: 'equations' as const, groupId: 'vs' }] : []),
    ],
    WHY.elementRelations,
  )

  const unknowns: VarRef[] = [...vt, ...xs]
  const equations = [...npEqs, ...constraintEqs]
  const { M, r } = systemFromEquations(equations, unknowns)
  const matrices: LabeledMatrix[] = [Qf, Ypm, Ytm]
  if (vSources.length) matrices.push(systemMatrix(net, 'M', 'Augmented node-pair system', M, r, equations, unknowns))
  sb.add('solve', 'Solve', `${unknowns.length} unknowns: ${unknowns.map((u) => u.text).join(', ')}.`, vSources.length ? [{ type: 'matrix', matrixId: 'M' }] : [], WHY.solve)
  const solved = solveOrFail(method, M, r, unknowns, sb, matrices)
  if (solved.ok === false) return solved

  const T = vt.length
  const v = matVec(QfT, solved.x.slice(0, T))
  const i = models.map((m, k) => {
    if (m.idealV) return solved.x[T + vSources.indexOf(m)]
    if (m.idealI) return m.knownI as number
    return (m.y as number) * (v[k] + m.vg) - m.ig
  })
  sb.steps[sb.steps.length - 1].blocks.push({ type: 'latex', latex: `v_t = ${matrixLatex(solved.x.slice(0, T).map((x) => [x]))}\\ \\mathrm{V}`, display: true })

  return finalize({
    method,
    net,
    prepared,
    sb,
    matrices,
    equationGroups: groups,
    unknowns,
    solve: solved,
    primary: vt.map((u, j) => ({ v: u, value: solved.x[j] })),
    v,
    i,
    models,
  })
}
