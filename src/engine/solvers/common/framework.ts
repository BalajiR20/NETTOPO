import type {
  AnalysisConfig,
  AnalysisError,
  AnalysisFailure,
  AnalysisResult,
  AnalysisStep,
  BranchQuantity,
  EquationGroup,
  LinearEquation,
  MethodId,
  StepBlock,
  Term,
  TreeInfo,
  VarRef,
} from '@/domain/analysis/types'
import { METHODS } from '@/domain/analysis/methods'
import { blockingIssues } from '@/domain/network/derive'
import type { Network, NodeId } from '@/domain/network/types'
import type { LabeledMatrix, MatrixAxisEntry, SpanningTree } from '@/domain/topology/types'
import { WHY } from '@/engine/explanations'
import { bfsOrder, edgesOf } from '@/engine/graph'
import { cleanZero, formatNumber, formatSI, formatValue, maxAbs, solveLinearSystem, type Matrix, type SolveSuccess, type Vector } from '@/engine/numerical'
import { checkWellPosedness, makeTree, suggestSpanningTree, validateTree } from '@/engine/topology'
import { verify } from '@/engine/verification'
import { equationLatex, varToken, type BranchModel } from './model'

/* ------------------------------ steps ------------------------------ */

export class StepBuilder {
  steps: AnalysisStep[] = []
  add(id: string, title: string, summary: string, blocks: StepBlock[] = [], why?: string): AnalysisStep {
    const s: AnalysisStep = { id, number: this.steps.length + 1, title, summary, blocks, why }
    this.steps.push(s)
    return s
  }
}

export function addIdentificationSteps(sb: StepBuilder, net: Network) {
  sb.add(
    'nodes',
    'Identify nodes',
    `n = ${net.nodes.length} nodes: ${net.nodes.map((n) => n.label).join(', ')}.`,
    [{ type: 'latex', latex: `n = ${net.nodes.length}` }],
    WHY.nodes,
  )
  sb.add(
    'branches',
    'Identify branches',
    `b = ${net.branches.length} branches, one per element.`,
    [
      {
        type: 'table',
        columns: ['Branch', 'Element', 'Value', 'From → To'],
        rows: net.branches.map((b) => [
          b.label,
          b.elementLabel,
          formatValue(b.element.value, b.element.type === 'resistor' ? 'Ω' : b.element.type === 'voltageSource' ? 'V' : 'A'),
          `${label(net, b.fromNode)} → ${label(net, b.toNode)}`,
        ]),
      },
    ],
    WHY.branches,
  )
  sb.add(
    'orientation',
    'Assign orientations',
    'Each branch arrow is its current reference direction; vₖ uses the passive sign convention.',
    [
      {
        type: 'list',
        items: net.branches.map((b) => {
          const src =
            b.element.type === 'voltageSource'
              ? `; source + terminal at ${label(net, b.polarity > 0 ? b.fromNode : b.toNode)} ⇒ v${b.index} = ${b.polarity > 0 ? '+' : '−'}E`
              : b.element.type === 'currentSource'
                ? `; source arrow ${b.polarity > 0 ? 'along' : 'against'} the branch ⇒ i${b.index} = ${b.polarity > 0 ? '+' : '−'}I`
                : ''
          return `${b.label}: ${label(net, b.fromNode)} → ${label(net, b.toNode)} (+ at ${label(net, b.fromNode)})${src}`
        }),
      },
    ],
    WHY.orientation,
  )
}

export const label = (net: Network, id: NodeId) => net.nodes.find((n) => n.id === id)?.label ?? id

/* ------------------------------ preflight ------------------------------ */

export interface Prepared {
  referenceNodeId: NodeId | null
  tree: SpanningTree | null
  treeInfo: TreeInfo | null
}

export function fail(method: MethodId, errors: AnalysisError[], steps: AnalysisStep[] = [], matrices: LabeledMatrix[] = []): AnalysisFailure {
  return { ok: false, method, errors, steps, matrices, computedAt: Date.now() }
}

export function preflight(net: Network, method: MethodId, config: AnalysisConfig): Prepared | AnalysisFailure {
  const info = METHODS[method]
  const blocking = blockingIssues(net)
  if (blocking.length) {
    return fail(
      method,
      blocking.map((i) => ({ code: 'network-invalid', message: i.message, hint: i.hint, branchIds: i.branchIds, nodeIds: i.nodeIds })),
    )
  }
  if (net.nodes.length < 2) {
    return fail(method, [{ code: 'network-invalid', message: 'The network needs at least two nodes.', hint: 'Connect components between at least two nodes.' }])
  }
  const wp = checkWellPosedness(net)
  if (!wp.ok) {
    return fail(
      method,
      wp.messages.map((m) => ({
        code: 'ill-posed' as const,
        message: m,
        hint: 'A unique solution requires a tree containing every voltage source and no current source (§17.3.1, §17.6.1). Add a resistor in series/parallel or remove the redundant source.',
        branchIds: [...wp.voltageSourceLoop, ...wp.currentSourceCutset],
      })),
    )
  }
  let referenceNodeId: NodeId | null = null
  if (info.requiresReference) {
    if (!config.referenceNodeId) {
      return fail(method, [
        {
          code: 'missing-reference',
          message: `Select a reference node before running ${info.title.toLowerCase().startsWith('incidence') ? 'the incidence-matrix analysis' : info.title.toLowerCase()}.`,
          hint: 'Click a node on the circuit or choose one from the list in the Analysis panel.',
        },
      ])
    }
    if (!net.nodes.some((n) => n.id === config.referenceNodeId)) {
      return fail(method, [
        { code: 'invalid-reference', message: 'The selected reference node no longer exists (the circuit changed).', hint: 'Select the reference node again.' },
      ])
    }
    referenceNodeId = config.referenceNodeId
  }
  let tree: SpanningTree | null = null
  let treeInfo: TreeInfo | null = null
  if (info.requiresTree) {
    if (!config.treeBranchIds || config.treeBranchIds.length === 0) {
      return fail(method, [
        { code: 'missing-tree', message: 'Select a spanning tree.', hint: 'Enter tree-selection mode and click branches to make them twigs, or press "Suggest valid tree".' },
      ])
    }
    const validation = validateTree(net, config.treeBranchIds)
    if (!validation.valid) {
      return fail(method, [
        {
          code: 'invalid-tree',
          message: validation.issues.map((i) => i.message).join(' ') || 'The selected branches do not form a spanning tree.',
          hint: 'Adjust the twig selection until the tree status shows VALID.',
          branchIds: validation.cycleBranchIds,
        },
      ])
    }
    tree = makeTree(net, config.treeBranchIds)
    treeInfo = { tree, validation }
  }
  return { referenceNodeId, tree, treeInfo }
}

/* ------------------------------ systems ------------------------------ */

export const varKey = (v: VarRef) => `${v.kind}:${v.id}`

export function makeEquation(net: Network, id: string, lhs: Term[], rhs: number, origin: string, ref?: string): LinearEquation {
  const clean = lhs.filter((t) => t.coef !== 0)
  return { id, lhs: clean, rhs, latex: equationLatex(net, clean, rhs), origin, ref }
}

/** Builds M x = r from structured equations; the SAME objects are rendered to the user. */
export function systemFromEquations(equations: LinearEquation[], unknowns: VarRef[]): { M: Matrix; r: Vector } {
  const col = new Map(unknowns.map((u, j) => [varKey(u), j]))
  const M = equations.map(() => new Array<number>(unknowns.length).fill(0))
  equations.forEach((eq, r) => {
    for (const t of eq.lhs) {
      const j = col.get(varKey(t.v))
      if (j === undefined) throw new Error(`Equation ${eq.id} uses unknown ${t.v.text} that is not in the unknown list.`)
      M[r][j] += t.coef
    }
  })
  return { M, r: equations.map((e) => e.rhs) }
}

export function systemMatrix(net: Network, id: string, title: string, M: Matrix, r: Vector, equations: LinearEquation[], unknowns: VarRef[]): LabeledMatrix {
  const rows: MatrixAxisEntry[] = equations.map((e, k) => ({ id: `eq:${e.id}`, label: `(${k + 1})`, latex: `(${k + 1})`, kind: 'equation', refId: e.ref }))
  const cols: MatrixAxisEntry[] = [
    ...unknowns.map((u) => ({ id: `u:${varKey(u)}`, label: u.text, latex: u.latex, kind: 'unknown' as const, refId: varToken(net, u) })),
    { id: 'rhs', label: 'r', latex: 'r', kind: 'rhs' as const },
  ]
  return {
    id,
    symbol: 'M\\,|\\,r',
    title,
    description: 'Coefficient matrix M of the unknowns with the right-hand side r appended (augmented matrix of M x = r).',
    kind: 'system',
    rows,
    cols,
    data: M.map((row, k) => [...row, r[k]]),
  }
}

export function solveOrFail(
  method: MethodId,
  M: Matrix,
  r: Vector,
  unknowns: VarRef[],
  sb: StepBuilder,
  matrices: LabeledMatrix[],
): SolveSuccess | AnalysisFailure {
  const res = solveLinearSystem(M, r)
  if (res.ok) return res
  const free = res.freeColumns.map((j) => unknowns[j]?.text).filter(Boolean)
  return fail(
    method,
    [
      {
        code: res.reason === 'singular' ? 'singular' : 'numerical',
        message: `${res.message}${free.length ? ` Undetermined unknowns: ${free.join(', ')}.` : ''}`,
        hint:
          res.reason === 'singular'
            ? 'A singular system means the unknowns are not uniquely determined. Typical causes: a loop made only of voltage sources, a cut-set made only of current sources, or part of the circuit isolated by sources.'
            : 'Check element values.',
      },
    ],
    sb.steps,
    matrices,
  )
}

/* ------------------------------ results ------------------------------ */

/** Node potentials from branch voltages by walking a tree from `refId` (§8 of MATHEMATICS.md). */
export function potentialsFromBranchVoltages(net: Network, v: Vector, tree: SpanningTree | null, refId: NodeId): Record<NodeId, number> {
  const t = tree ?? suggestSpanningTree(net)
  const out: Record<NodeId, number> = {}
  if (!t) return out
  const twigs = net.branches.filter((b) => t.twigIds.includes(b.id))
  const order = bfsOrder(
    net.nodes.map((n) => n.id),
    edgesOf(twigs),
    refId,
  )
  out[refId] = 0
  for (const { node, via } of order) {
    if (!via) continue
    const k = net.branches.findIndex((b) => b.id === via.branchId)
    // v_k = φ(from) − φ(to). Stepping along orientation: φ(to) = φ(from) − v_k.
    out[node] = cleanZero(via.forward ? out[via.from] - v[k] : out[via.from] + v[k])
  }
  return out
}

export function defaultPotentialReference(net: Network): NodeId {
  return net.groundNodeId ?? net.nodes[net.nodes.length - 1].id
}

export interface FinalizeInput {
  method: MethodId
  net: Network
  prepared: Prepared
  sb: StepBuilder
  matrices: LabeledMatrix[]
  equationGroups: EquationGroup[]
  unknowns: VarRef[]
  solve: SolveSuccess
  primary: { v: VarRef; value: number }[]
  v: Vector
  i: Vector
  /** Node voltages computed by the method itself (incidence, nodal). */
  nodeVoltages?: Record<NodeId, number>
  warnings?: string[]
  models: BranchModel[]
}

export function finalize(input: FinalizeInput): AnalysisResult {
  const { net, prepared, sb } = input
  const scale = Math.max(1, maxAbs(input.v), maxAbs(input.i))
  const v = input.v.map((x) => cleanZero(x, scale))
  const i = input.i.map((x) => cleanZero(x, scale))
  const potentialReferenceNodeId = prepared.referenceNodeId ?? defaultPotentialReference(net)
  const nodeVoltages = input.nodeVoltages ?? potentialsFromBranchVoltages(net, v, prepared.tree, potentialReferenceNodeId)

  const branches: BranchQuantity[] = net.branches.map((b, k) => ({ branchId: b.id, current: i[k], voltage: v[k], power: cleanZero(v[k] * i[k], scale * scale) }))
  const branchCurrents = Object.fromEntries(branches.map((q) => [q.branchId, q.current]))
  const branchVoltages = Object.fromEntries(branches.map((q) => [q.branchId, q.voltage]))

  sb.add(
    'currents',
    'Calculate branch currents',
    'Every branch current follows from the primary unknowns.',
    [
      {
        type: 'table',
        columns: ['Branch', 'Element', 'iₖ', 'Actual direction'],
        rows: net.branches.map((b, k) => [
          b.label,
          b.elementLabel,
          formatSI(i[k], 'A', 4),
          i[k] === 0 ? 'no current' : i[k] > 0 ? `${label(net, b.fromNode)} → ${label(net, b.toNode)}` : `${label(net, b.toNode)} → ${label(net, b.fromNode)} (reversed)`,
        ]),
      },
    ],
    WHY.orientation,
  )
  sb.add(
    'voltages',
    'Calculate branch voltages',
    'Branch voltages with the passive sign convention (+ at the from-node).',
    [
      {
        type: 'table',
        columns: ['Branch', 'vₖ', 'pₖ = vₖiₖ', 'Power'],
        rows: branches.map((q) => {
          const b = net.branches.find((x) => x.id === q.branchId)!
          return [b.label, formatSI(q.voltage, 'V', 4), formatSI(q.power, 'W', 4), q.power > 0 ? 'absorbed' : q.power < 0 ? 'delivered' : '—']
        }),
      },
    ],
  )

  const verification = verify({ net, v, i, tree: prepared.tree, solverResidual: input.solve.residual, solverScale: scale })
  sb.add(
    'verify',
    'Verify',
    `Overall: ${verification.overall.toUpperCase()}. ${verification.checks.map((c) => `${c.title}: ${c.status.toUpperCase()}`).join(' · ')}`,
    [
      { type: 'latex', latex: `\\sum_k v_k i_k = ${formatNumber(branches.reduce((s, q) => s + q.voltage * q.current, 0), 4).replace('−', '-')}` },
      { type: 'text', text: WHY.tellegen },
    ],
    WHY.verify,
  )
  sb.add('visualize', 'Visualize', 'Currents, voltages and power are shown on the circuit. Open the oscilloscope to view them as signals.', [], WHY.visualize)

  return {
    ok: true,
    method: input.method,
    networkSnapshot: net,
    referenceNodeId: prepared.referenceNodeId,
    potentialReferenceNodeId,
    nodeVoltagesDerived: !input.nodeVoltages,
    tree: prepared.treeInfo,
    matrices: input.matrices,
    equationGroups: input.equationGroups,
    unknowns: input.unknowns,
    solution: input.solve.x,
    primary: input.primary,
    nodeVoltages,
    branchCurrents,
    branchVoltages,
    branches,
    verification,
    steps: sb.steps,
    warnings: [...(input.warnings ?? []), ...input.solve.warnings, ...net.issues.filter((x) => x.severity === 'warning').map((x) => x.message)],
    solver: { size: input.unknowns.length, residual: input.solve.residual, conditionEstimate: input.solve.conditionEstimate, rank: input.solve.rank },
    computedAt: Date.now(),
  }
}

/** Element relation equations (generalised branch model), shared by the tableau methods. */
export function elementEquations(net: Network, models: BranchModel[], vars: { v: (k: number) => VarRef; i: (k: number) => VarRef }): LinearEquation[] {
  return models.map((m, k) => {
    const b = m.branch
    if (m.kind === 'resistor')
      return makeEquation(net, `el${b.index}`, [{ coef: 1, v: vars.v(k) }, { coef: -(m.z as number), v: vars.i(k) }], 0, `${b.elementLabel}: vₖ = R iₖ (R = ${formatValue(m.z as number, 'Ω')})`, `b${b.index}`)
    if (m.kind === 'voltageSource')
      return makeEquation(net, `el${b.index}`, [{ coef: 1, v: vars.v(k) }], m.knownV as number, `${b.elementLabel}: ideal voltage source, vₖ = ${b.polarity > 0 ? '+' : '−'}E`, `b${b.index}`)
    return makeEquation(net, `el${b.index}`, [{ coef: 1, v: vars.i(k) }], m.knownI as number, `${b.elementLabel}: ideal current source, iₖ = ${b.polarity > 0 ? '+' : '−'}I`, `b${b.index}`)
  })
}

/** Diagonal branch admittance / impedance matrix for display. */
export function branchDiagonalMatrix(net: Network, kind: 'Y' | 'Z', models: BranchModel[]): LabeledMatrix {
  const axis: MatrixAxisEntry[] = net.branches.map((b) => ({ id: `branch:${b.id}`, label: b.label, latex: `b_{${b.index}}`, kind: 'branch', refId: b.id }))
  const val = (m: BranchModel) => (kind === 'Y' ? (m.idealV ? 0 : (m.y ?? 0)) : m.idealI ? 0 : (m.z ?? 0))
  return {
    id: kind === 'Y' ? 'Yp' : 'Zp',
    symbol: kind === 'Y' ? 'Y_p' : 'Z_p',
    title: kind === 'Y' ? 'Branch admittance matrix' : 'Branch impedance matrix',
    description:
      kind === 'Y'
        ? 'Diagonal matrix of branch admittances yₖ = 1/Rₖ. Ideal source branches contribute 0 here; their constraints are added separately.'
        : 'Diagonal matrix of branch impedances zₖ = Rₖ. Ideal source branches contribute 0 here; their constraints are added separately.',
    kind: kind === 'Y' ? 'branch-admittance' : 'branch-impedance',
    rows: axis,
    cols: axis,
    data: models.map((m, r) => models.map((_, c) => (r === c ? val(m) : 0))),
  }
}

export const sourceVectorTable = (models: BranchModel[]): StepBlock => ({
  type: 'table',
  columns: ['Branch', 'Element', 'zₖ', 'yₖ', 'v_gk', 'i_gk'],
  rows: models.map((m) => [
    m.branch.label,
    m.branch.elementLabel,
    m.idealI ? '∞ (ideal)' : formatNumber(m.z ?? 0),
    m.idealV ? '∞ (ideal)' : formatNumber(m.y ?? 0),
    formatNumber(m.vg),
    formatNumber(m.ig),
  ]),
})

export const methodTitle = (m: MethodId) => METHODS[m].title
