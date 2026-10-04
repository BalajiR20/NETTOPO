import type { AnalysisConfig, AnalysisOutcome, EquationGroup, VarRef } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import { METHOD_WHY, WHY } from '@/engine/explanations'
import { transpose } from '@/engine/numerical'
import { fundamentalCutSetMatrix, fundamentalCutSets } from '@/engine/topology'
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
import { branchModels, matrixLatex, refToken, varI, varV, varVt } from '../common/model'
import { addCutSetStep, addTreeStep } from '../common/treeSteps'

/**
 * Fundamental-cut-set-matrix method (§17.8–17.9): the f-cut-set tableau
 *   Qf i = 0           (n−1 KCL equations)
 *   v − Qfᵀ vₜ = 0     (b twig-voltage relations, i.e. KVL)
 *   element relations  (b equations)
 */
export function solveFundamentalCutSet(net: Network, config: AnalysisConfig): AnalysisOutcome {
  const method = 'fcutset' as const
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
  sb.add(
    'matrix',
    'Construct fundamental cut-set matrix Qf',
    `Qf is ${Qf.rows.length}×${Qf.cols.length} = (n − 1) × b. With twigs first it has the form [U | Q_fl].`,
    [{ type: 'matrix', matrixId: 'Qf' }],
    WHY.fcutset,
  )

  const models = branchModels(net)
  const b = net.branches.length
  const twigs = Qf.rows.map((r) => net.branches.find((x) => x.id === r.refId)!)
  const vt = twigs.map(varVt)
  const vb = net.branches.map(varV)
  const ib = net.branches.map(varI)
  const QfT = transpose(Qf.data, b)

  const kcl = twigs.map((t, r) =>
    makeEquation(net, `kcl-${r}`, net.branches.map((_, k) => ({ coef: Qf.data[r][k], v: ib[k] })), 0, `KCL for the f-cut-set of twig ${t.label}.`, refToken.twig(t)),
  )
  const tv = net.branches.map((br, k) =>
    makeEquation(
      net,
      `tv-${k}`,
      [{ coef: 1, v: vb[k] }, ...vt.map((u, j) => ({ coef: -QfT[k][j], v: u }))],
      0,
      `${br.label}: branch voltage as a combination of twig voltages (column ${br.index} of Qf).`,
      refToken.branch(br),
    ),
  )
  const elements = elementEquations(net, models, { v: (k) => vb[k], i: (k) => ib[k] })
  const groups: EquationGroup[] = [
    { id: 'kcl', title: 'KCL — f-cut-set form', matrixForm: 'Q_f\\,i = 0', description: WHY.kclQf, equations: kcl },
    { id: 'tv', title: 'Twig-voltage relations (KVL)', matrixForm: 'v = Q_f^{T} v_t', description: WHY.twigVoltages, equations: tv },
    { id: 'element', title: 'Element relations', matrixForm: 'v_k = R_k i_k,\\ v_k = sE_k,\\ i_k = sI_k', description: WHY.elementRelations, equations: elements },
  ]
  sb.add('equations', 'Generate f-cut-set equations', `${kcl.length} KCL equations and ${tv.length} twig-voltage relations.`, [
    { type: 'latex', latex: 'Q_f\\,i = 0 \\qquad v = Q_f^{T} v_t', display: true },
    { type: 'equations', groupId: 'kcl' },
    { type: 'equations', groupId: 'tv' },
  ], METHOD_WHY.fcutset)
  sb.add('elements', 'Insert component equations', `${elements.length} element relations complete the system.`, [{ type: 'equations', groupId: 'element' }], WHY.elementRelations)

  const unknowns: VarRef[] = [...vt, ...vb, ...ib]
  const equations = [...kcl, ...tv, ...elements]
  const { M, r } = systemFromEquations(equations, unknowns)
  const matrices = [Qf, systemMatrix(net, 'M', 'f-cut-set tableau system', M, r, equations, unknowns)]
  sb.add('solve', 'Solve', `Square system of ${unknowns.length} equations in vₜ, v and i.`, [{ type: 'matrix', matrixId: 'M' }], WHY.solve)
  const solved = solveOrFail(method, M, r, unknowns, sb, matrices)
  if (solved.ok === false) return solved
  const T = vt.length
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
    v: solved.x.slice(T, T + b),
    i: solved.x.slice(T + b, T + 2 * b),
    models,
  })
}
