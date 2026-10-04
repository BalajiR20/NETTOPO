import type { BranchId, NodeId } from '@/domain/network/types'

/** What a matrix row/column stands for: lets the UI map entries back to the circuit. */
export type AxisKind = 'node' | 'branch' | 'fcircuit' | 'fcutset' | 'equation' | 'unknown' | 'rhs'

export interface MatrixAxisEntry {
  id: string
  /** Plain-text label (n1, b3, f-circuit(b5)). */
  label: string
  /** LaTeX label. */
  latex: string
  kind: AxisKind
  /**
   * Reference into the network: node id for 'node', branch id for 'branch',
   * LINK branch id for 'fcircuit', TWIG branch id for 'fcutset'. For
   * 'equation' / 'unknown' an optional VarRef string (see analysis types).
   */
  refId?: string
  /** Partition tag: twig / link / passive / source / augmented. */
  group?: string
}

export type MatrixKind =
  | 'all-incidence'
  | 'incidence'
  | 'fcircuit'
  | 'fcutset'
  | 'branch-admittance'
  | 'branch-impedance'
  | 'node-admittance'
  | 'loop-impedance'
  | 'node-pair-admittance'
  | 'system'
  | 'check'

export interface LabeledMatrix {
  id: string
  /** LaTeX symbol, e.g. "A", "B_f", "Q_f", "Y_n". */
  symbol: string
  title: string
  description: string
  kind: MatrixKind
  rows: MatrixAxisEntry[]
  cols: MatrixAxisEntry[]
  data: number[][]
}

export interface SpanningTree {
  twigIds: BranchId[]
  linkIds: BranchId[]
}

export type TreeIssueCode = 'too-few' | 'too-many' | 'cycle' | 'disconnected' | 'nodes-missing' | 'unknown-branch'

export interface TreeValidation {
  valid: boolean
  selected: number
  required: number
  nodesCovered: number
  totalNodes: number
  /** The selected branches form one connected subgraph covering their nodes. */
  connected: boolean
  hasCycle: boolean
  /** Branches participating in a detected cycle (for highlighting). */
  cycleBranchIds: BranchId[]
  issues: { code: TreeIssueCode; message: string }[]
}

/** The f-circuit formed by adding `linkId` to the tree (§17.5). Orientation agrees with the link. */
export interface FundamentalCircuit {
  linkId: BranchId
  /** Branch → +1 (agrees with traversal) / −1 (disagrees). Contains the link (+1). */
  entries: Record<BranchId, 1 | -1>
  /** Branches in traversal order starting with the link. */
  branchOrder: BranchId[]
  /** Nodes in traversal order (closed: first node is not repeated). */
  nodeOrder: NodeId[]
}

/** The f-cut-set defined by removing `twigId` from the tree (§17.8.4). Orientation agrees with the twig. */
export interface FundamentalCutSet {
  twigId: BranchId
  entries: Record<BranchId, 1 | -1>
  /** Node group containing the twig's from-node (cut-set oriented from this side). */
  sideFrom: NodeId[]
  /** Node group containing the twig's to-node. */
  sideTo: NodeId[]
}
