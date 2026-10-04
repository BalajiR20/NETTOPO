import type { AnalysisConfig, AnalysisOutcome, EquationGroup, VarRef } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import { METHOD_WHY, WHY } from '@/engine/explanations'
import { allIncidenceMatrix, reducedIncidenceMatrix } from '@/engine/topology'
import {
  addIdentificationSteps,
  elementEquations,
  finalize,
  label,
  makeEquation,
  preflight,
  solveOrFail,
  StepBuilder,
  systemFromEquations,
  systemMatrix,
} from '../common/framework'
import { branchModels, matrixLatex, refToken, varI, varV, varVn } from '../common/model'

/**
 * Incidence-matrix method (§17.2–17.3): the topological tableau
 *   A i = 0            (n−1 KCL equations)
 *   v − Aᵀ vₙ = 0      (b node-transformation equations)
 *   element relations  (b equations)
 * solved together for vₙ, v and i. No tree is required.
 */
export function solveIncidence(net: Network, config: AnalysisConfig): AnalysisOutcome {
  const method = 'incidence' as const
  const prepared = preflight(net, method, config)
  if ('ok' in prepared) return prepared
  const ref = prepared.referenceNodeId!
  const sb = new StepBuilder()
  addIdentificationSteps(sb, net)
  sb.add(
    'reference',
    'Select reference node',
    `Reference node: ${label(net, ref)}. Its row is removed from Aₐ and all node voltages are measured from it.`,
    [{ type: 'latex', latex: `v_{n,\\mathrm{ref}} = 0` }],
    WHY.reference,
  )

  const Aa = allIncidenceMatrix(net)
  const A = reducedIncidenceMatrix(net, ref)
  sb.add('topology', 'Construct topology', 'No tree is needed: the incidence matrix uses only node–branch incidence.', [
    { type: 'text', text: METHOD_WHY.incidence },
  ])
  sb.add(
    'matrix',
    'Construct incidence matrices',
    `Aₐ is ${Aa.rows.length}×${Aa.cols.length}; removing the reference row gives A (${A.rows.length}×${A.cols.length}).`,
    [
      { type: 'matrix', matrixId: 'Aa' },
      { type: 'matrix', matrixId: 'A' },
    ],
    WHY.incidenceEntry,
  )

  const models = branchModels(net)
  const nodeRows = net.nodes.filter((n) => n.id !== ref)
  const vn = nodeRows.map((n) => varVn(net, n.id))
  const vb = net.branches.map(varV)
  const ib = net.branches.map(varI)

  const kcl = nodeRows.map((n, r) =>
    makeEquation(
      net,
      `kcl-${r}`,
      net.branches.map((_, k) => ({ coef: A.data[r][k], v: ib[k] })),
      0,
      `KCL at node ${n.label}: sum of branch currents leaving the node.`,
      refToken.node(net, n.id),
    ),
  )
  const transform = net.branches.map((b, k) =>
    makeEquation(
      net,
      `nt-${k}`,
      [{ coef: 1, v: vb[k] }, ...nodeRows.map((_, r) => ({ coef: -A.data[r][k], v: vn[r] }))],
      0,
      `Node transformation for ${b.label}: v${b.index} = vₙ(${label(net, b.fromNode)}) − vₙ(${label(net, b.toNode)}).`,
      refToken.branch(b),
    ),
  )
  const elements = elementEquations(net, models, { v: (k) => vb[k], i: (k) => ib[k] })

  const groups: EquationGroup[] = [
    { id: 'kcl', title: 'KCL — incidence form', matrixForm: 'A\\,i = 0', description: WHY.kclA, equations: kcl },
    { id: 'kvl', title: 'Node transformation (KVL)', matrixForm: 'v = A^{T} v_n', description: WHY.nodeTransformation, equations: transform },
    { id: 'element', title: 'Element relations', matrixForm: 'v_k = R_k i_k,\\ v_k = sE_k,\\ i_k = sI_k', description: WHY.elementRelations, equations: elements },
  ]
  sb.add('equations', 'Generate topological equations', `${kcl.length} KCL equations from A and ${transform.length} node-transformation equations from Aᵀ.`, [
    { type: 'latex', latex: `A\\,i = 0 \\qquad v = A^{T} v_n`, display: true },
    { type: 'equations', groupId: 'kcl' },
    { type: 'equations', groupId: 'kvl' },
  ], WHY.kclA)
  sb.add('elements', 'Insert component equations', `${elements.length} element relations complete the system.`, [{ type: 'equations', groupId: 'element' }], WHY.elementRelations)

  const unknowns: VarRef[] = [...vn, ...vb, ...ib]
  const equations = [...kcl, ...transform, ...elements]
  const { M, r } = systemFromEquations(equations, unknowns)
  const sys = systemMatrix(net, 'M', 'Topological tableau system', M, r, equations, unknowns)
  const matrices = [Aa, A, sys]
  sb.add('solve', 'Solve', `Square system of ${unknowns.length} equations in ${unknowns.length} unknowns (vₙ, v, i).`, [{ type: 'matrix', matrixId: 'M' }], WHY.solve)
  const solved = solveOrFail(method, M, r, unknowns, sb, matrices)
  if (solved.ok === false) return solved
  const s = solved

  const nv = nodeRows.length
  const b = net.branches.length
  const nodeVoltages: Record<string, number> = { [ref]: 0 }
  nodeRows.forEach((n, j) => (nodeVoltages[n.id] = s.x[j]))
  const v = s.x.slice(nv, nv + b)
  const i = s.x.slice(nv + b, nv + 2 * b)
  sb.steps[sb.steps.length - 1].blocks.push({ type: 'latex', latex: `v_n = ${matrixLatex(nodeRows.map((_, j) => [s.x[j]]))}\\ \\mathrm{V}`, display: true })

  return finalize({
    method,
    net,
    prepared,
    sb,
    matrices,
    equationGroups: groups,
    unknowns,
    solve: s,
    primary: vn.map((u, j) => ({ v: u, value: s.x[j] })),
    v,
    i,
    nodeVoltages,
    models,
  })
}
