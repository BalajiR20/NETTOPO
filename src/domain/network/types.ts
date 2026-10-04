import type { Element } from '@/domain/elements'
import type { Point } from '@/domain/schematic/types'

export type NodeId = string
export type BranchId = string

/** A node of the linear oriented graph (§17.1). */
export interface NetworkNode {
  id: NodeId
  label: string
  /** Drawing position only (centroid of the node's pins). Never used by the mathematics. */
  position: Point
  /** True when a ground symbol is attached. A suggested (not mandatory) reference node. */
  isGround: boolean
  /** Schematic marker ids that belong to this node. */
  markerIds: string[]
  /** Pin keys (ownerId:pin) that belong to this node. */
  pinKeys: string[]
}

/** A branch of the linear oriented graph. Orientation = reference direction of iₖ. */
export interface Branch {
  id: BranchId
  /** 1-based branch number k. */
  index: number
  /** b1, b2, … */
  label: string
  fromNode: NodeId
  toNode: NodeId
  /** Explicit orientation: +1 when the branch runs from pin a to pin b of its element. */
  orientation: 'a-to-b' | 'b-to-a'
  /** Element polarity relative to the branch orientation (s = ±1). */
  polarity: 1 | -1
  element: Element
  /** Element label (R1, V1, I1). */
  elementLabel: string
  componentId: string
  /** i_k / v_k in LaTeX. */
  currentVariable: string
  voltageVariable: string
}

export type NetworkIssueSeverity = 'error' | 'warning'

export type NetworkIssueCode =
  | 'empty'
  | 'self-loop'
  | 'floating-node'
  | 'invalid-value'
  | 'disconnected'
  | 'unconnected-pin'
  | 'multiple-labels'

export interface NetworkIssue {
  code: NetworkIssueCode
  severity: NetworkIssueSeverity
  message: string
  /** Actionable next step. */
  hint?: string
  branchIds?: BranchId[]
  nodeIds?: NodeId[]
  componentIds?: string[]
}

export interface Network {
  nodes: NetworkNode[]
  branches: Branch[]
  groundNodeId: NodeId | null
  issues: NetworkIssue[]
}

export const nodeById = (net: Network, id: NodeId) => net.nodes.find((n) => n.id === id)
export const branchById = (net: Network, id: BranchId) => net.branches.find((b) => b.id === id)
