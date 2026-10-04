import type { AnalysisConfig, AnalysisOutcome, EquationGroup, VarRef } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import { METHOD_WHY, WHY } from '@/engine/explanations'
import { transpose } from '@/engine/numerical'
import { fundamentalCircuitMatrix, fundamentalCircuits } from '@/engine/topology'
import {
  addIdentificationSteps,
  elementEquations,
  finalize,
  makeEquation,
  preflight,
  solveOrFail,
  StepBuilder,
  systemFromEquations,
  systemMatrix,
} from '../common/framework'
import { branchModels, matrixLatex, refToken, varI, varIl, varV } from '../common/model'
import { addFundamentalCircuitStep, addTreeStep } from '../common/treeSteps'

/**
 * Fundamental-circuit-matrix method (§17.5–17.6): the f-circuit tableau
 *   Bf v = 0           (b−n+1 KVL equations)
 *   i − Bfᵀ iₗ = 0     (b link-current relations, i.e. KCL)
 *   element relations  (b equations)
 */
export function solveFundamentalCircuit(net: Network, config: AnalysisConfig): AnalysisOutcome {
  const method = 'fcircuit' as const
  const prepared = preflight(net, method, config)
  if ('ok' in prepared) return prepared
  const tree = prepared.tree!
  const sb = new StepBuilder()
  addIdentificationSteps(sb, net)
  addTreeStep(sb, net, tree)
  const circuits = fundamentalCircuits(net, tree)
  prepared.treeInfo!.fundamentalCircuits = circuits
  addFundamentalCircuitStep(sb, net, circuits)
  const Bf = fundamentalCircuitMatrix(net, tree, circuits)
  sb.add(
    'matrix',
    'Construct fundamental circuit matrix Bf',
    `Bf is ${Bf.rows.length}×${Bf.cols.length} = (b − n + 1) × b. With twigs first it has the form [B_ft | U].`,
    [{ type: 'matrix', matrixId: 'Bf' }],
    WHY.fcircuit,
  )

  const models = branchModels(net)
  const b = net.branches.length
  const links = Bf.rows.map((r) => net.branches.find((x) => x.id === r.refId)!)
  const il = links.map(varIl)
  const vb = net.branches.map(varV)
  const ib = net.branches.map(varI)
  const BfT = transpose(Bf.data, b)

  const kvl = links.map((l, r) =>
    makeEquation(net, `kvl-${r}`, net.branches.map((_, k) => ({ coef: Bf.data[r][k], v: vb[k] })), 0, `KVL around the f-circuit of link ${l.label}.`, refToken.loop(l)),
  )
  const lc = net.branches.map((br, k) =>
    makeEquation(
      net,
      `lc-${k}`,
      [{ coef: 1, v: ib[k] }, ...il.map((u, j) => ({ coef: -BfT[k][j], v: u }))],
      0,
      `${br.label}: branch current as a combination of link currents (column ${br.index} of Bf).`,
      refToken.branch(br),
    ),
  )
  const elements = elementEquations(net, models, { v: (k) => vb[k], i: (k) => ib[k] })
  const groups: EquationGroup[] = [
    { id: 'kvl', title: 'KVL — f-circuit form', matrixForm: 'B_f\\,v = 0', description: WHY.kvlBf, equations: kvl },
    { id: 'lc', title: 'Loop-current relations (KCL)', matrixForm: 'i = B_f^{T} i_l', description: WHY.linkCurrents, equations: lc },
    { id: 'element', title: 'Element relations', matrixForm: 'v_k = R_k i_k,\\ v_k = sE_k,\\ i_k = sI_k', description: WHY.elementRelations, equations: elements },
  ]
  sb.add('equations', 'Generate f-circuit equations', `${kvl.length} KVL equations and ${lc.length} loop-current relations.`, [
    { type: 'latex', latex: 'B_f\\,v = 0 \\qquad i = B_f^{T} i_l', display: true },
    { type: 'equations', groupId: 'kvl' },
    { type: 'equations', groupId: 'lc' },
  ], METHOD_WHY.fcircuit)
  sb.add('elements', 'Insert component equations', `${elements.length} element relations complete the system.`, [{ type: 'equations', groupId: 'element' }], WHY.elementRelations)

  const unknowns: VarRef[] = [...il, ...vb, ...ib]
  const equations = [...kvl, ...lc, ...elements]
  const { M, r } = systemFromEquations(equations, unknowns)
  const matrices = [Bf, systemMatrix(net, 'M', 'f-circuit tableau system', M, r, equations, unknowns)]
  sb.add('solve', 'Solve', `Square system of ${unknowns.length} equations in iₗ, v and i.`, [{ type: 'matrix', matrixId: 'M' }], WHY.solve)
  const solved = solveOrFail(method, M, r, unknowns, sb, matrices)
  if (solved.ok === false) return solved
  const L = il.length
  if (L) sb.steps[sb.steps.length - 1].blocks.push({ type: 'latex', latex: `i_l = ${matrixLatex(solved.x.slice(0, L).map((x) => [x]))}\\ \\mathrm{A}`, display: true })

  return finalize({
    method,
    net,
    prepared,
    sb,
    matrices,
    equationGroups: groups,
    unknowns,
    solve: solved,
    primary: il.map((u, j) => ({ v: u, value: solved.x[j] })),
    v: solved.x.slice(L, L + b),
    i: solved.x.slice(L + b, L + 2 * b),
    models,
  })
}
