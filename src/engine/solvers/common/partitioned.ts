import type { AnalysisConfig, AnalysisOutcome, EquationGroup, LinearEquation, StepBlock, VarRef } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import type { LabeledMatrix, MatrixAxisEntry } from '@/domain/topology/types'
import { METHOD_WHY, WHY } from '@/engine/explanations'
import { formatNumber, formatValue, matVec, pickColumns, transpose } from '@/engine/numerical'
import {
  allIncidenceMatrix,
  fundamentalCircuitMatrix,
  fundamentalCircuits,
  fundamentalCutSetMatrix,
  fundamentalCutSets,
  reducedIncidenceMatrix,
} from '@/engine/topology'
import { addIdentificationSteps, finalize, label, makeEquation, preflight, solveOrFail, StepBuilder, systemFromEquations, systemMatrix } from './framework'
import { branchModels, matrixLatex, refToken, varIl, varVn, varVt, varXi, varXv, type BranchModel } from './model'
import { addCutSetStep, addFundamentalCircuitStep, addTreeStep } from './treeSteps'

/**
 * The textbook's PARTITIONED solution procedures (Chapter 17):
 *
 *   method     book section   matrix  branch law   solution
 *   ---------  -------------  ------  -----------  -----------------------------------------
 *   incidence  §17.3, §17.4   A       Ip = Yp Vp   Yn = Ap Yp Apᵀ,  Vn = −Yn⁻¹ Ag Ig
 *   fcircuit   §17.6, §17.7   Bf      Vp = Zp Ip   Z_L = Bfp Zp Bfpᵀ, Il = −Z_L⁻¹ Bfg Vg
 *   fcutset    §17.9, §17.10  Qf      Ip = Yp Vp   Yt = Qfp Yp Qfpᵀ,  Vt = −Yt⁻¹ Qfg Ig
 *
 * The columns of the topology matrix are arranged [passive | independent
 * sources of the book's kind] exactly as the book prescribes. The book removes
 * the *other* kind of ideal source by v-shift / i-shift (a manual circuit edit);
 * NETTOPO instead appends a third partition [T_a] with the augmentation
 * (IMPLEMENTATION DETAIL, MATHEMATICS.md §5), which gives the same answer.
 *
 * TEXTBOOK CONCEPT: everything up to and including Yn / Z_L / Yt.
 * IMPLEMENTATION DETAIL: the augmentation block and the ordering of the
 * rows of the solved system.
 */

export type PartitionedMethod = 'incidence' | 'fcircuit' | 'fcutset'

interface Spec {
  method: PartitionedMethod
  /** Branch relation is written with admittances (Y) or impedances (Z). */
  dom: 'Y' | 'Z'
  /** The primary unknown is a voltage vector (A, Qf) or the link-current vector (Bf). */
  primaryIsVoltage: boolean
  /** Independent source kind that the book keeps in the partition [T_p | T_g]. */
  gKind: 'currentSource' | 'voltageSource'
  /** The other ideal-source kind (augmented here, shifted away in the book). */
  aKind: 'currentSource' | 'voltageSource'
  sections: string
  names: { plain: string; coreU: string; prodU: string; xU: string; gU: string; T: string; Tp: string; Tg: string; Ta: string; core: string; coreId: string; coreTitle: string; x: string; xLatex: string; gLatex: string; aLatex: string }
  matrixIds: { Tp: string; Tg: string; Ta: string }
}

const SPECS: Record<PartitionedMethod, Spec> = {
  incidence: {
    method: 'incidence',
    dom: 'Y',
    primaryIsVoltage: true,
    gKind: 'currentSource',
    aKind: 'voltageSource',
    sections: '§17.3–17.4',
    names: { plain: 'A', coreU: 'Yₙ', prodU: 'Aₚ Yₚ Aₚᵀ', xU: 'Vₙ', gU: 'I_g', T: 'A', Tp: 'A_p', Tg: 'A_g', Ta: 'A_v', core: 'Y_n', coreId: 'Yn', coreTitle: 'Nodal admittance matrix', x: 'v_n', xLatex: 'V_n', gLatex: 'I_g', aLatex: 'I_v' },
    matrixIds: { Tp: 'Ap', Tg: 'Ag', Ta: 'Av' },
  },
  fcircuit: {
    method: 'fcircuit',
    dom: 'Z',
    primaryIsVoltage: false,
    gKind: 'voltageSource',
    aKind: 'currentSource',
    sections: '§17.6–17.7',
    names: { plain: 'Bf', coreU: 'Z_L', prodU: 'Bf_p Zₚ Bf_pᵀ', xU: 'Iₗ', gU: 'V_g', T: 'B_f', Tp: 'B_{fp}', Tg: 'B_{fg}', Ta: 'B_{fi}', core: 'Z_L', coreId: 'ZL', coreTitle: 'Loop impedance matrix', x: 'i_l', xLatex: 'I_l', gLatex: 'V_g', aLatex: 'V_i' },
    matrixIds: { Tp: 'Bfp', Tg: 'Bfg', Ta: 'Bfi' },
  },
  fcutset: {
    method: 'fcutset',
    dom: 'Y',
    primaryIsVoltage: true,
    gKind: 'currentSource',
    aKind: 'voltageSource',
    sections: '§17.9–17.10',
    names: { plain: 'Qf', coreU: 'Yₜ', prodU: 'Qf_p Yₚ Qf_pᵀ', xU: 'Vₜ', gU: 'I_g', T: 'Q_f', Tp: 'Q_{fp}', Tg: 'Q_{fg}', Ta: 'Q_{fv}', core: 'Y_t', coreId: 'Yt', coreTitle: 'Node-pair admittance matrix', x: 'v_t', xLatex: 'V_t', gLatex: 'I_g', aLatex: 'I_v' },
    matrixIds: { Tp: 'Qfp', Tg: 'Qfg', Ta: 'Qfv' },
  },
}

const PARTITION_WHY =
  'The book numbers the passive branches first and the independent sources last (§17.4, §17.7, §17.10), so the columns of the topology matrix split into [passive | sources]. Only the passive part meets the branch relation, which is why the equation contains T_p Y_p T_pᵀ (or T_p Z_p T_pᵀ) and the source part appears only on the right-hand side.'
const AUGMENT_WHY =
  'The book removes this kind of ideal source by v-shift (§17.4.1) or i-shift (§17.7.1) before applying the procedure. NETTOPO keeps the circuit unchanged: the source’s own current (or voltage) becomes an extra unknown with the constraint “source value = given”. The result is identical to the book’s.'

export function solvePartitioned(net: Network, config: AnalysisConfig, method: PartitionedMethod): AnalysisOutcome {
  const S = SPECS[method]
  const prepared = preflight(net, method, config)
  if ('ok' in prepared) return prepared
  const sb = new StepBuilder()
  addIdentificationSteps(sb, net)
  const matrices: LabeledMatrix[] = []

  /* ---------- topology matrix T (A, Bf or Qf) ---------- */
  let T: LabeledMatrix
  let rowRefToken: (rowRefId: string) => string
  let rowVar: (rowRefId: string) => VarRef
  let rowName: (r: MatrixAxisEntry) => string

  if (method === 'incidence') {
    const ref = prepared.referenceNodeId!
    sb.add(
      'reference',
      'Select reference node',
      `Reference node: ${label(net, ref)}. Its row is removed from Aₐ and all node voltages are measured from it (the last-numbered node in the book).`,
      [{ type: 'latex', latex: 'v_{n,\\mathrm{ref}} = 0' }],
      WHY.reference,
    )
    const Aa = allIncidenceMatrix(net)
    T = reducedIncidenceMatrix(net, ref)
    sb.add(
      'matrix',
      'Construct incidence matrix A',
      `Aₐ is ${Aa.rows.length}×${Aa.cols.length}; removing the reference row gives A (${T.rows.length}×${T.cols.length}).`,
      [
        { type: 'matrix', matrixId: 'Aa' },
        { type: 'matrix', matrixId: 'A' },
      ],
      WHY.incidenceEntry,
    )
    matrices.push(Aa, T)
    rowRefToken = (id) => refToken.node(net, id)
    rowVar = (id) => varVn(net, id)
    rowName = (r) => `node ${r.label}`
  } else if (method === 'fcircuit') {
    const tree = prepared.tree!
    addTreeStep(sb, net, tree)
    const circuits = fundamentalCircuits(net, tree)
    prepared.treeInfo!.fundamentalCircuits = circuits
    addFundamentalCircuitStep(sb, net, circuits)
    T = fundamentalCircuitMatrix(net, tree, circuits)
    sb.add(
      'matrix',
      'Construct fundamental circuit matrix Bf',
      `Bf is ${T.rows.length}×${T.cols.length} = (b − n + 1) × b. With twigs first it has the form [B_ft | U].`,
      [{ type: 'matrix', matrixId: 'Bf' }],
      WHY.fcircuit,
    )
    matrices.push(T)
    rowRefToken = (id) => refToken.loop(net.branches.find((x) => x.id === id)!)
    rowVar = (id) => varIl(net.branches.find((x) => x.id === id)!)
    rowName = (r) => `the ${r.label}`
  } else {
    const tree = prepared.tree!
    addTreeStep(sb, net, tree)
    const cutsets = fundamentalCutSets(net, tree)
    prepared.treeInfo!.fundamentalCutSets = cutsets
    addCutSetStep(sb, net, cutsets)
    T = fundamentalCutSetMatrix(net, tree, cutsets)
    sb.add(
      'matrix',
      'Construct fundamental cut-set matrix Qf',
      `Qf is ${T.rows.length}×${T.cols.length} = (n − 1) × b. With twigs first it has the form [U | Q_fl].`,
      [{ type: 'matrix', matrixId: 'Qf' }],
      WHY.fcutset,
    )
    matrices.push(T)
    rowRefToken = (id) => refToken.twig(net.branches.find((x) => x.id === id)!)
    rowVar = (id) => varVt(net.branches.find((x) => x.id === id)!)
    rowName = (r) => `the ${r.label}`
  }

  const R = T.rows.length
  const b = net.branches.length
  const models = branchModels(net)

  /* ---------- partition the columns: [passive | sources] (book numbering scheme) ---------- */
  const idxOf = (pred: (m: BranchModel) => boolean) => models.filter(pred).map((m) => m.col)
  const pIdx = idxOf((m) => m.kind === 'resistor')
  const gIdx = idxOf((m) => m.kind === S.gKind)
  const aIdx = idxOf((m) => m.kind === S.aKind)
  const sub = (idx: number[], id: string, symbol: string, title: string, description: string): LabeledMatrix => ({
    id,
    symbol,
    title,
    description,
    kind: T.kind,
    rows: T.rows,
    cols: idx.map((j) => T.cols[j]),
    data: pickColumns(T.data, idx),
  })
  const gWord = S.gKind === 'currentSource' ? 'independent current-source' : 'independent voltage-source'
  const aWord = S.aKind === 'currentSource' ? 'ideal current-source' : 'ideal voltage-source'
  const Tp = sub(pIdx, S.matrixIds.Tp, S.names.Tp, `Passive part of ${S.names.plain}`, 'Columns of the passive (resistor) branches.')
  const Tg = sub(gIdx, S.matrixIds.Tg, S.names.Tg, `Source part (${gWord} branches)`, `Columns of the ${gWord} branches. They multiply the known source vector only.`)
  const Ta = sub(aIdx, S.matrixIds.Ta, S.names.Ta, `Augmentation part (${aWord} branches)`, `Columns of the ${aWord} branches (NETTOPO's replacement for the book's ${S.aKind === 'voltageSource' ? 'v-shift' : 'i-shift'}).`)
  matrices.push(Tp)
  if (gIdx.length) matrices.push(Tg)
  if (aIdx.length) matrices.push(Ta)

  const labs = (idx: number[]) => idx.map((j) => net.branches[j].label).join(', ') || 'none'
  sb.add(
    'partition',
    `Partition ${S.names.plain} into passive and source branches`,
    `Columns arranged [passive | sources]: passive (${labs(pIdx)}) | ${gWord} (${labs(gIdx)})${aIdx.length ? ` | ${aWord} (${labs(aIdx)})` : ''}.`,
    [
      {
        type: 'latex',
        latex: `${S.names.T} = \\left[\\,${S.names.Tp}\\;\\;${S.names.Tg}${aIdx.length ? `\\;\\;${S.names.Ta}` : ''}\\,\\right]`,
        display: true,
      },
      { type: 'matrix', matrixId: Tp.id },
      ...(gIdx.length ? [{ type: 'matrix', matrixId: Tg.id } as StepBlock] : []),
      ...(aIdx.length ? [{ type: 'matrix', matrixId: Ta.id } as StepBlock, { type: 'text', text: AUGMENT_WHY } as StepBlock] : []),
    ],
    PARTITION_WHY,
  )

  /* ---------- Kirchhoff's laws in partitioned form ---------- */
  const aTerm = aIdx.length ? ` + ${S.names.Ta}\\,${S.names.aLatex}` : ''
  const lawBlocks: StepBlock[] = []
  if (method === 'incidence') {
    lawBlocks.push(
      { type: 'latex', latex: `A_p I_p + A_g I_g${aTerm} = 0 \\qquad (17.4\\text{-}1)\\ \\text{KCL}`, display: true },
      { type: 'latex', latex: `V_p = A_p^{T} V_n,\\quad V_g = A_g^{T} V_n${aIdx.length ? ',\\quad V_v = A_v^{T} V_n' : ''} \\qquad (17.4\\text{-}2)\\ \\text{node transformation}`, display: true },
    )
  } else if (method === 'fcircuit') {
    lawBlocks.push(
      { type: 'latex', latex: `B_{fg} V_g + B_{fp} V_p${aTerm} = 0 \\qquad (17.7\\text{-}1)\\ \\text{KVL}`, display: true },
      { type: 'latex', latex: `I_p = B_{fp}^{T} I_l,\\quad I_g = B_{fg}^{T} I_l${aIdx.length ? ',\\quad I_i = B_{fi}^{T} I_l' : ''} \\qquad (17.7\\text{-}5)`, display: true },
    )
  } else {
    lawBlocks.push(
      { type: 'latex', latex: `Q_{fg} I_g + Q_{fp} I_p${aTerm} = 0 \\qquad (17.10\\text{-}1)\\ \\text{KCL}`, display: true },
      { type: 'latex', latex: `V_p = Q_{fp}^{T} V_t,\\quad V_g = Q_{fg}^{T} V_t${aIdx.length ? ',\\quad V_v = Q_{fv}^{T} V_t' : ''} \\qquad (17.10\\text{-}2)`, display: true },
    )
  }
  sb.add(
    'laws',
    `Write Kirchhoff’s laws in ${S.names.plain} form`,
    method === 'incidence' ? 'KCL from A and the node transformation equation (§17.3, §17.4).' : method === 'fcircuit' ? 'KVL from Bf and the link-current relation (§17.6, §17.7).' : 'KCL from Qf and the twig-voltage relation (§17.9, §17.10).',
    lawBlocks,
    method === 'incidence' ? WHY.kclA + ' ' + WHY.nodeTransformation : method === 'fcircuit' ? WHY.kvlBf + ' ' + WHY.linkCurrents : WHY.kclQf + ' ' + WHY.twigVoltages,
  )

  /* ---------- branch relation: Yp (or Zp) for the passive branches only ---------- */
  const passiveAxis: MatrixAxisEntry[] = pIdx.map((j) => {
    const br = net.branches[j]
    return { id: `branch:${br.id}`, label: br.label, latex: `b_{${br.index}}`, kind: 'branch', refId: br.id }
  })
  const d = pIdx.map((j) => (S.dom === 'Y' ? (models[j].y as number) : (models[j].z as number)))
  const Dm: LabeledMatrix = {
    id: S.dom === 'Y' ? 'Yp' : 'Zp',
    symbol: S.dom === 'Y' ? 'Y_p' : 'Z_p',
    title: S.dom === 'Y' ? 'Branch admittance matrix Yp' : 'Branch impedance matrix Zp',
    description: S.dom === 'Y' ? 'bₚ × bₚ diagonal matrix of the admittances of the passive branches (17.4-3 / 17.10-3).' : 'bₚ × bₚ diagonal matrix of the impedances of the passive branches (17.7-3).',
    kind: S.dom === 'Y' ? 'branch-admittance' : 'branch-impedance',
    rows: passiveAxis,
    cols: passiveAxis.map((x) => ({ ...x })),
    data: d.map((di, r) => d.map((_, c) => (r === c ? di : 0))),
  }
  matrices.push(Dm)
  sb.add(
    'branch-relation',
    `Form ${S.dom === 'Y' ? 'Yₚ' : 'Zₚ'}`,
    S.dom === 'Y' ? `Iₚ = Yₚ Vₚ with Yₚ = diag(${pIdx.map((j) => formatValue(models[j].y as number, 'S')).join(', ') || '—'}).` : `Vₚ = Zₚ Iₚ with Zₚ = diag(${pIdx.map((j) => formatValue(models[j].z as number, 'Ω')).join(', ') || '—'}).`,
    [{ type: 'latex', latex: S.dom === 'Y' ? 'I_p = Y_p V_p' : 'V_p = Z_p I_p', display: true }, { type: 'matrix', matrixId: Dm.id }],
    WHY.elementRelations,
  )

  /* ---------- the book's matrix product: Yn / Z_L / Yt ---------- */
  const core: number[][] = Array.from({ length: R }, (_, r) =>
    Array.from({ length: R }, (_, c) => pIdx.reduce((s, _j, q) => s + Tp.data[r][q] * d[q] * Tp.data[c][q], 0)),
  )
  const coreKind = method === 'incidence' ? 'node-admittance' : method === 'fcircuit' ? 'loop-impedance' : 'node-pair-admittance'
  const coreMatrix: LabeledMatrix = {
    id: S.names.coreId,
    symbol: S.names.core,
    title: S.names.coreTitle,
    description: `${S.names.core} = ${S.names.Tp} ${S.dom === 'Y' ? 'Y_p' : 'Z_p'} ${S.names.Tp}ᵀ (order ${R}). Diagonal: sum of the ${S.dom === 'Y' ? 'admittances' : 'impedances'} of the passive branches in the row's ${method === 'incidence' ? 'node' : method === 'fcircuit' ? 'f-circuit' : 'f-cut-set'}; off-diagonal: ± the sum of those common to two rows.`,
    kind: coreKind,
    rows: T.rows,
    cols: T.rows.map((r) => ({ ...r })),
    data: core,
  }
  matrices.push(coreMatrix)

  const gv = gIdx.map((j) => (S.gKind === 'currentSource' ? (models[j].knownI as number) : (models[j].knownV as number)))
  const rhs = Array.from({ length: R }, (_, r) => -gIdx.reduce((s, _j, q) => s + Tg.data[r][q] * gv[q], 0))
  const coreLatex = `${S.names.core} = ${S.names.Tp}\\,${S.dom === 'Y' ? 'Y_p' : 'Z_p'}\\,${S.names.Tp}^{T}`
  sb.add(
    'core',
    `Compute ${S.names.coreU} = ${S.names.prodU}`,
    `${coreMatrix.title}, order ${R}: the matrix product of the three matrices above.`,
    [
      { type: 'latex', latex: coreLatex, display: true },
      { type: 'matrix', matrixId: coreMatrix.id },
    ],
    method === 'incidence' ? WHY.nodeTransformation : METHOD_WHY[method],
  )

  /* ---------- source vector ---------- */
  sb.add(
    'sources',
    `Identify ${S.names.gU} and form −${S.names.plain}_g ${S.names.gU}`,
    gIdx.length ? `${S.names.gLatex}: ${gIdx.map((j, q) => `${net.branches[j].label} = ${formatNumber(gv[q])} ${S.gKind === 'currentSource' ? 'A' : 'V'}`).join(', ')}.` : `There are no ${gWord} branches, so the right-hand side is zero.`,
    [
      ...(gIdx.length
        ? [
            { type: 'latex', latex: `${S.names.gLatex} = ${matrixLatex(gv.map((x) => [x]))}`, display: true } as StepBlock,
            { type: 'latex', latex: `-${S.names.Tg}\\,${S.names.gLatex} = ${matrixLatex(rhs.map((x) => [x]))}`, display: true } as StepBlock,
          ]
        : []),
    ],
  )

  /* ---------- the book's equation, as structured equations (the system shown = the system solved) ---------- */
  const xv = T.rows.map((r) => rowVar(r.refId!))
  const aVar = (j: number) => (S.primaryIsVoltage ? varXi(net.branches[j]) : varXv(net.branches[j]))
  const xa = aIdx.map(aVar)
  const mainEqs: LinearEquation[] = T.rows.map((row, r) =>
    makeEquation(
      net,
      `main-${r}`,
      [...xv.map((u, c) => ({ coef: core[r][c], v: u })), ...aIdx.map((_j, q) => ({ coef: Ta.data[r][q], v: xa[q] }))],
      rhs[r],
      method === 'incidence'
        ? `Row of Yₙ: KCL at ${rowName(row)} after substituting Iₚ = Yₚ ApᵀVₙ.`
        : method === 'fcircuit'
          ? `Row of Z_L: KVL around ${rowName(row)} after substituting Iₚ = Bfpᵀ Iₗ and Vₚ = Zₚ Iₚ.`
          : `Row of Yₜ: KCL for ${rowName(row)} after substituting Vₚ = Qfpᵀ Vₜ and Iₚ = Yₚ Vₚ.`,
      rowRefToken(row.refId!),
    ),
  )
  const constraintEqs: LinearEquation[] = aIdx.map((j, q) =>
    makeEquation(
      net,
      `aug-${net.branches[j].index}`,
      xv.map((u, r) => ({ coef: Ta.data[r][q], v: u })),
      S.aKind === 'voltageSource' ? (models[j].knownV as number) : (models[j].knownI as number),
      S.aKind === 'voltageSource'
        ? `Ideal voltage source ${net.branches[j].elementLabel}: v${net.branches[j].index} = (${S.names.plain === 'A' ? 'Aᵥ' : 'Qfᵥ'}ᵀ ${S.names.xU})ₖ equals the given source voltage.`
        : `Ideal current source ${net.branches[j].elementLabel}: i${net.branches[j].index} = (Bfᵢᵀ Iₗ)ₖ equals the given source current.`,
      refToken.branch(net.branches[j]),
    ),
  )
  const mainForm = `${S.names.core} ${S.names.x} ${aIdx.length ? `+ ${S.names.Ta}\\,${S.names.aLatex}` : ''} = -${S.names.Tg} ${S.names.gLatex}`
  const groups: EquationGroup[] = [
    { id: 'main', title: method === 'incidence' ? 'Nodal equation (A-matrix form)' : method === 'fcircuit' ? 'Loop equation (Bf form)' : 'Node-pair equation (Qf form)', matrixForm: mainForm, description: PARTITION_WHY, equations: mainEqs },
  ]
  if (aIdx.length) groups.push({ id: 'aug', title: `Ideal ${S.aKind === 'voltageSource' ? 'voltage' : 'current'}-source constraints`, matrixForm: `${S.names.Ta}^{T} ${S.names.x} = ${S.aKind === 'voltageSource' ? 'V_v' : 'I_i'}`, description: AUGMENT_WHY, equations: constraintEqs })

  const sectionNo = method === 'incidence' ? '(17.4-4)' : method === 'fcircuit' ? '(17.7-6)' : '(17.10-5)'
  sb.add(
    'equations',
    method === 'incidence' ? 'Substitute into KCL: nodal equation' : method === 'fcircuit' ? 'Substitute into KVL: loop equation' : 'Substitute into KCL: node-pair equation',
    `Equation ${sectionNo}: ${S.names.coreU} ${S.names.xU} = −${S.names.plain}_g ${S.names.gU}${aIdx.length ? ' (plus the augmentation block)' : ''}.`,
    [
      { type: 'latex', latex: `${S.names.core} ${S.names.x} = -${S.names.Tg}\\,${S.names.gLatex}`, display: true },
      { type: 'equations', groupId: 'main' },
      ...(aIdx.length ? [{ type: 'equations', groupId: 'aug' } as StepBlock] : []),
    ],
    method === 'incidence' ? METHOD_WHY.nodal : METHOD_WHY[method === 'fcircuit' ? 'loop' : 'nodePair'],
  )

  /* ---------- solve ---------- */
  const unknowns: VarRef[] = [...xv, ...xa]
  const equations = [...mainEqs, ...constraintEqs]
  const { M, r } = systemFromEquations(equations, unknowns)
  if (aIdx.length) matrices.push(systemMatrix(net, 'M', `Augmented ${S.names.coreU} system`, M, r, equations, unknowns))
  sb.add(
    'solve',
    'Solve',
    aIdx.length
      ? `${unknowns.length} unknowns: ${unknowns.map((u) => u.text).join(', ')}.`
      : `${S.names.xU} = −[${S.names.coreU}]⁻¹ ${S.names.plain}_g ${S.names.gU} (order ${R}).`,
    aIdx.length ? [{ type: 'matrix', matrixId: 'M' }] : [],
    WHY.solve,
  )
  const solved = solveOrFail(method, M, r, unknowns, sb, matrices)
  if (solved.ok === false) return solved
  const x = solved.x.slice(0, R)
  const xaVal = solved.x.slice(R)
  if (R) sb.steps[sb.steps.length - 1].blocks.push({ type: 'latex', latex: `${S.names.x} = ${matrixLatex(x.map((y) => [y]))}\\ \\mathrm{${S.primaryIsVoltage ? 'V' : 'A'}}`, display: true })

  /* ---------- back-substitution (book: "obtain the branch voltages and currents") ---------- */
  const TT = transpose(T.data, b)
  const prim = R ? matVec(TT, x) : new Array<number>(b).fill(0)
  const v: number[] = new Array(b).fill(0)
  const i: number[] = new Array(b).fill(0)
  if (S.primaryIsVoltage) {
    // v = Tᵀ vₜ (17.3-3 / 17.10-2); passive currents Iₚ = Yₚ Vₚ; source currents known or from the solve
    models.forEach((m, k) => {
      v[k] = prim[k]
      i[k] = m.kind === 'resistor' ? (m.y as number) * prim[k] : m.kind === 'currentSource' ? (m.knownI as number) : xaVal[aIdx.indexOf(k)]
    })
  } else {
    // i = Bfᵀ iₗ (17.7-5); passive voltages Vₚ = Zₚ Iₚ; source voltages known or from the solve
    models.forEach((m, k) => {
      i[k] = prim[k]
      v[k] = m.kind === 'resistor' ? (m.z as number) * prim[k] : m.kind === 'voltageSource' ? (m.knownV as number) : xaVal[aIdx.indexOf(k)]
    })
  }
  sb.add(
    'recover',
    'Recover branch voltages and currents',
    S.primaryIsVoltage
      ? `V = ${S.names.plain}ᵀ ${S.names.xU}, then Iₚ = Yₚ Vₚ; the source voltages come from the same product.`
      : 'I = Bfᵀ Iₗ, then Vₚ = Zₚ Iₚ; the source currents come from the same product.',
    [
      {
        type: 'latex',
        latex: S.primaryIsVoltage
          ? `V = ${S.names.T}^{T} ${S.names.x},\\qquad I_p = Y_p V_p${aIdx.length ? ',\\quad I_v\\ \\text{from the augmented solution}' : ''}`
          : `I = ${S.names.T}^{T} ${S.names.x},\\qquad V_p = Z_p I_p${aIdx.length ? ',\\quad V_i\\ \\text{from the augmented solution}' : ''}`,
        display: true,
      },
    ],
  )

  const nodeVoltages: Record<string, number> | undefined =
    method === 'incidence'
      ? Object.fromEntries([[prepared.referenceNodeId!, 0], ...T.rows.map((row, j) => [row.refId!, x[j]] as [string, number])])
      : undefined

  return finalize({
    method,
    net,
    prepared,
    sb,
    matrices,
    equationGroups: groups,
    unknowns,
    solve: solved,
    primary: xv.map((u, j) => ({ v: u, value: x[j] })),
    v,
    i,
    nodeVoltages,
    models,
  })
}
