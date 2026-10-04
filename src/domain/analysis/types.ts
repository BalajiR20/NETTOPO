import type { BranchId, Network, NodeId } from '@/domain/network/types'
import type { FundamentalCircuit, FundamentalCutSet, LabeledMatrix, SpanningTree, TreeValidation } from '@/domain/topology/types'

export const METHOD_IDS = ['incidence', 'nodal', 'fcircuit', 'loop', 'fcutset', 'nodePair'] as const
export type MethodId = (typeof METHOD_IDS)[number]

export interface MethodInfo {
  id: MethodId
  title: string
  short: string
  /** One-paragraph description: what it does. */
  description: string
  requiresReference: boolean
  requiresTree: boolean
  /** Textbook section. */
  section: string
  /** Primary unknowns (LaTeX). */
  unknownsLatex: string
  /** Core equation (LaTeX). */
  coreEquation: string
}

export interface AnalysisConfig {
  referenceNodeId?: NodeId | null
  /** Twig branch ids of the user-selected spanning tree. */
  treeBranchIds?: BranchId[] | null
}

/* ------------------------------ Variables ------------------------------ */

/**
 * Variable references are encoded as strings so they can travel through
 * KaTeX's \htmlData{ref=…}: "branch:<id>", "node:<id>", "fcircuit:<linkId>",
 * "fcutset:<twigId>". The VarRef kind distinguishes current vs voltage.
 */
export type VarKind = 'i' | 'v' | 'vn' | 'il' | 'vt' | 'xi' | 'xv'

export interface VarRef {
  kind: VarKind
  /** Network id the variable belongs to (branch id or node id). */
  id: string
  /** LaTeX symbol, e.g. i_{3}. */
  latex: string
  /** Plain text, e.g. i3. */
  text: string
  unit: 'A' | 'V'
}

export interface Term {
  coef: number
  v: VarRef
}

export interface LinearEquation {
  id: string
  lhs: Term[]
  rhs: number
  /** Ready-to-render LaTeX with \htmlData refs on every variable. */
  latex: string
  /** Short explanation of where the equation comes from. */
  origin: string
  /** Optional network reference (node for KCL, link for KVL, …) for highlighting. */
  ref?: string
}

export interface EquationGroup {
  id: string
  title: string
  /** Matrix-form statement, e.g. A\,i = 0. */
  matrixForm: string
  description: string
  equations: LinearEquation[]
}

/* ------------------------------ Steps ------------------------------ */

export type StepBlock =
  | { type: 'text'; text: string }
  | { type: 'latex'; latex: string; display?: boolean }
  | { type: 'matrix'; matrixId: string }
  | { type: 'equations'; groupId: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; columns: string[]; rows: string[][] }

export interface AnalysisStep {
  id: string
  number: number
  title: string
  summary: string
  why?: string
  blocks: StepBlock[]
}

/* ------------------------------ Verification ------------------------------ */

export type CheckStatus = 'pass' | 'warning' | 'fail' | 'skipped'

export interface VerificationCheck {
  id: 'kcl' | 'kvl' | 'element' | 'tellegen' | 'orthogonality-a' | 'orthogonality-q' | 'tree' | 'residual' | 'dimensions'
  title: string
  status: CheckStatus
  residual: number | null
  tolerance: number | null
  /** LaTeX of the checked relation. */
  relation: string
  detail: string
  /** Per-item residuals (node, loop, branch) for drill-down. */
  items?: { label: string; ref?: string; residual: number; expression?: string }[]
}

export interface VerificationReport {
  checks: VerificationCheck[]
  overall: CheckStatus
}

/* ------------------------------ Result ------------------------------ */

export interface SolverInfo {
  size: number
  residual: number
  conditionEstimate: number | null
  rank: number
}

export interface TreeInfo {
  tree: SpanningTree
  validation: TreeValidation
  fundamentalCircuits?: FundamentalCircuit[]
  fundamentalCutSets?: FundamentalCutSet[]
}

export interface BranchQuantity {
  branchId: BranchId
  current: number
  voltage: number
  /** Absorbed power vₖ iₖ (passive sign convention); negative = delivered. */
  power: number
}

export interface AnalysisResult {
  ok: true
  method: MethodId
  networkSnapshot: Network
  referenceNodeId: NodeId | null
  /** Reference used for displayed node potentials (may differ from referenceNodeId for tree methods). */
  potentialReferenceNodeId: NodeId
  nodeVoltagesDerived: boolean
  tree: TreeInfo | null
  matrices: LabeledMatrix[]
  equationGroups: EquationGroup[]
  unknowns: VarRef[]
  solution: number[]
  /** Primary method variables (loop currents, twig voltages, node voltages). */
  primary: { v: VarRef; value: number }[]
  nodeVoltages: Record<NodeId, number>
  branchCurrents: Record<BranchId, number>
  branchVoltages: Record<BranchId, number>
  branches: BranchQuantity[]
  verification: VerificationReport
  steps: AnalysisStep[]
  warnings: string[]
  solver: SolverInfo
  computedAt: number
}

export type FailureCode =
  | 'network-invalid'
  | 'missing-reference'
  | 'invalid-reference'
  | 'missing-tree'
  | 'invalid-tree'
  | 'ill-posed'
  | 'singular'
  | 'ill-conditioned'
  | 'unsupported'
  | 'numerical'

export interface AnalysisError {
  code: FailureCode
  message: string
  hint?: string
  branchIds?: BranchId[]
  nodeIds?: NodeId[]
}

export interface AnalysisFailure {
  ok: false
  method: MethodId
  errors: AnalysisError[]
  /** Steps completed before the failure, so the user sees how far it got. */
  steps: AnalysisStep[]
  matrices: LabeledMatrix[]
  computedAt: number
}

export type AnalysisOutcome = AnalysisResult | AnalysisFailure
