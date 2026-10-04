import type { AnalysisConfig, AnalysisOutcome, EquationGroup, LinearEquation, VarRef } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import type { LabeledMatrix } from '@/domain/topology/types'
import { METHOD_WHY, WHY } from '@/engine/explanations'
import { matVec, multiply, transpose } from '@/engine/numerical'
import { fundamentalCircuitMatrix, fundamentalCircuits } from '@/engine/topology'
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
import { branchModels, matrixLatex, refToken, varI, varIl, varV, varXv } from '../common/model'
import { addFundamentalCircuitStep, addTreeStep } from '../common/treeSteps'

/**
 * Loop analysis with the generalised branch model (§17.7, §17.11.2):
 *   Bf Zp Bfᵀ iₗ = Bf (v_g − Zp i_g)
 * Ideal current sources are handled by augmentation (MATHEMATICS.md §5).
 */
export function solveLoop(net: Network, config: AnalysisConfig): AnalysisOutcome {
  const method = 'loop' as const
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
  sb.add('matrix', 'Construct fundamental circuit matrix Bf', `Bf is ${Bf.rows.length}×${Bf.cols.length}.`, [{ type: 'matrix', matrixId: 'Bf' }], WHY.fcircuit)

  const models = branchModels(net)
  const b = net.branches.length
  const Zpm = branchDiagonalMatrix(net, 'Z', models)
  const Zp = Zpm.data
  const BfT = transpose(Bf.data, b)
  const ZL = multiply(multiply(Bf.data, Zp), BfT, { aCols: b, bCols: Bf.data.length })
  const rhs = matVec(Bf.data, models.map((m, k) => m.vg - Zp[k][k] * m.ig))

  const links = Bf.rows.map((r) => net.branches.find((x) => x.id === r.refId)!)
  const il = links.map(varIl)
  const iSources = models.filter((m) => m.idealI)
  const xs = iSources.map((m) => varXv(m.branch))

  const ZLm: LabeledMatrix = {
    id: 'ZL',
    symbol: 'Z_L',
    title: 'Loop impedance matrix',
    description: 'Z_L = Bf Zₚ Bfᵀ. Diagonal: sum of impedances in the f-circuit. Off-diagonal: ± sum of impedances common to two f-circuits (+ if traversed in the same direction) (§17.7).',
    kind: 'loop-impedance',
    rows: Bf.rows,
    cols: Bf.rows.map((r) => ({ ...r })),
    data: ZL,
  }

  const loopEqs: LinearEquation[] = links.map((l, r) =>
    makeEquation(
      net,
      `loop-${r}`,
      [...il.map((u, j) => ({ coef: ZL[r][j], v: u })), ...iSources.map((m, q) => ({ coef: Bf.data[r][m.col], v: xs[q] }))],
      rhs[r],
      `KVL around the f-circuit of link ${l.label} with vₖ = zₖ(iₖ + i_gk) − v_gk and i = Bfᵀiₗ.`,
      refToken.loop(l),
    ),
  )
  const constraintEqs: LinearEquation[] = iSources.map((m) =>
    makeEquation(
      net,
      `is-${m.branch.index}`,
      il.map((u, j) => ({ coef: Bf.data[j][m.col], v: u })),
      m.knownI as number,
      `Ideal current source ${m.branch.elementLabel}: i${m.branch.index} = (Bfᵀiₗ)${m.branch.index} = ${m.branch.polarity > 0 ? '+' : '−'}I.`,
      refToken.branch(m.branch),
    ),
  )
  // Display-only: the KVL rows Bf v = 0 and link-current relations i = Bfᵀ iₗ.
  const kvlRows: LinearEquation[] = links.map((l, r) =>
    makeEquation(net, `kvl-${r}`, net.branches.map((br, k) => ({ coef: Bf.data[r][k], v: varV(br) })), 0, `KVL, f-circuit of ${l.label}.`, refToken.loop(l)),
  )
  const currentRows: LinearEquation[] = net.branches.map((br, k) =>
    makeEquation(net, `lc-${k}`, [{ coef: 1, v: varI(br) }, ...il.map((u, j) => ({ coef: -BfT[k][j], v: u }))], 0, `${br.label} current from link currents.`, refToken.branch(br)),
  )

  const groups: EquationGroup[] = [
    { id: 'kvl', title: 'KVL — f-circuit form', matrixForm: 'B_f\\,v = 0', description: WHY.kvlBf, equations: kvlRows },
    { id: 'lc', title: 'Link-current relations', matrixForm: 'i = B_f^{T} i_l', description: WHY.linkCurrents, equations: currentRows },
    { id: 'element', title: 'Element relations', matrixForm: 'v_k = z_k(i_k + i_{gk}) - v_{gk}', description: WHY.elementRelations, equations: elementEquations(net, models, { v: (k) => varV(net.branches[k]), i: (k) => varI(net.branches[k]) }) },
    {
      id: 'loop',
      title: 'Loop equations',
      matrixForm: iSources.length ? 'B_f Z_p B_f^{T} i_l + B_I\\, v_I = B_f\\left(v_g - Z_p i_g\\right)' : 'B_f Z_p B_f^{T} i_l = B_f\\left(v_g - Z_p i_g\\right)',
      description: METHOD_WHY.loop,
      equations: loopEqs,
    },
  ]
  if (iSources.length) groups.push({ id: 'is', title: 'Ideal current-source constraints', matrixForm: 'B_I^{T} i_l = i_I', description: WHY.idealSourcesLoop, equations: constraintEqs })

  sb.add(
    'equations',
    'Generate loop equations',
    'Substitute the element relations and i = Bfᵀiₗ into Bf v = 0.',
    [
      { type: 'latex', latex: 'B_f\\,v = 0,\\quad i = B_f^{T} i_l,\\quad v = Z_p(i + i_g) - v_g', display: true },
      { type: 'latex', latex: '\\Rightarrow\\ B_f Z_p B_f^{T} i_l = B_f\\left(v_g - Z_p i_g\\right)', display: true },
      { type: 'equations', groupId: 'kvl' },
    ],
    WHY.kvlBf,
  )
  sb.add(
    'elements',
    'Insert component equations',
    `Branch impedances form Zₚ; Z_L = Bf Zₚ Bfᵀ is ${ZL.length}×${ZL.length}.`,
    [
      sourceVectorTable(models),
      { type: 'matrix', matrixId: 'Zp' },
      { type: 'matrix', matrixId: 'ZL' },
      { type: 'latex', latex: `B_f\\left(v_g - Z_p i_g\\right) = ${matrixLatex(rhs.map((x) => [x]))}`, display: true },
      ...(iSources.length ? [{ type: 'text' as const, text: WHY.idealSourcesLoop }] : []),
      { type: 'equations', groupId: 'loop' },
      ...(iSources.length ? [{ type: 'equations' as const, groupId: 'is' }] : []),
    ],
    WHY.elementRelations,
  )

  const unknowns: VarRef[] = [...il, ...xs]
  const equations = [...loopEqs, ...constraintEqs]
  const { M, r } = systemFromEquations(equations, unknowns)
  const matrices: LabeledMatrix[] = [Bf, Zpm, ZLm]
  if (iSources.length) matrices.push(systemMatrix(net, 'M', 'Augmented loop system', M, r, equations, unknowns))
  sb.add('solve', 'Solve', `${unknowns.length} unknowns: ${unknowns.map((u) => u.text).join(', ') || 'none'}.`, iSources.length ? [{ type: 'matrix', matrixId: 'M' }] : [], WHY.solve)
  const solved = solveOrFail(method, M, r, unknowns, sb, matrices)
  if (solved.ok === false) return solved

  const L = il.length
  const i = matVec(BfT, solved.x.slice(0, L))
  const v = models.map((m, k) => {
    if (m.idealI) return solved.x[L + iSources.indexOf(m)]
    if (m.idealV) return m.knownV as number
    return (m.z as number) * (i[k] + m.ig) - m.vg
  })
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
    v,
    i,
    models,
  })
}
