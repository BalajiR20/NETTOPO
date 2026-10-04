import type { Branch, Network, NodeId } from '@/domain/network/types'
import type { LabeledMatrix, MatrixAxisEntry } from '@/domain/topology/types'
import { det, multiply, transpose } from '@/engine/numerical'

/**
 * Incidence matrices (§17.2).
 *   a_ij = +1  branch j incident at node i, oriented AWAY from it
 *   a_ij = −1  branch j incident at node i, oriented TOWARDS it
 *   a_ij =  0  branch j not incident at node i
 */
export function incidenceEntry(branch: Pick<Branch, 'fromNode' | 'toNode'>, nodeId: NodeId): 1 | -1 | 0 {
  if (branch.fromNode === branch.toNode) return 0
  if (branch.fromNode === nodeId) return 1
  if (branch.toNode === nodeId) return -1
  return 0
}

export const nodeAxis = (net: Network, nodeIds: NodeId[]): MatrixAxisEntry[] =>
  nodeIds.map((id) => {
    const n = net.nodes.find((x) => x.id === id)!
    return { id: `node:${id}`, label: n.label, latex: `\\text{${escapeText(n.label)}}`, kind: 'node', refId: id }
  })

export const branchAxis = (net: Network, branchIds?: string[], groupOf?: (id: string) => string | undefined): MatrixAxisEntry[] =>
  (branchIds ?? net.branches.map((b) => b.id)).map((id) => {
    const b = net.branches.find((x) => x.id === id)!
    return { id: `branch:${id}`, label: b.label, latex: `b_{${b.index}}`, kind: 'branch', refId: id, group: groupOf?.(id) }
  })

export function escapeText(s: string): string {
  return s.replace(/[\\{}_^#$%&~]/g, (c) => `\\${c === '\\' ? 'textbackslash ' : c}`)
}

/** Raw incidence data for the given node rows (natural branch order). */
export function incidenceData(net: Network, nodeIds: NodeId[]): number[][] {
  return nodeIds.map((n) => net.branches.map((b) => incidenceEntry(b, n)))
}

/** All-incidence matrix Aa (n × b). */
export function allIncidenceMatrix(net: Network): LabeledMatrix {
  const nodeIds = net.nodes.map((n) => n.id)
  return {
    id: 'Aa',
    symbol: 'A_a',
    title: 'All-incidence matrix',
    description: 'One row per node, one column per branch. Every column has exactly one +1 (node the branch leaves) and one −1 (node it enters), so the rows sum to zero.',
    kind: 'all-incidence',
    rows: nodeAxis(net, nodeIds),
    cols: branchAxis(net),
    data: incidenceData(net, nodeIds),
  }
}

/** Reduced incidence matrix A ((n−1) × b): Aa with the reference node row removed. */
export function reducedIncidenceMatrix(net: Network, referenceNodeId: NodeId): LabeledMatrix {
  const nodeIds = net.nodes.map((n) => n.id).filter((id) => id !== referenceNodeId)
  const ref = net.nodes.find((n) => n.id === referenceNodeId)
  return {
    id: 'A',
    symbol: 'A',
    title: 'Reduced incidence matrix',
    description: `Aₐ with the row of reference node "${ref?.label ?? referenceNodeId}" removed. Its rank is n − 1 for a connected graph.`,
    kind: 'incidence',
    rows: nodeAxis(net, nodeIds),
    cols: branchAxis(net),
    data: incidenceData(net, nodeIds),
  }
}

export function explainIncidenceEntry(net: Network, nodeId: NodeId, branchId: string): string {
  const b = net.branches.find((x) => x.id === branchId)
  const n = net.nodes.find((x) => x.id === nodeId)
  if (!b || !n) return ''
  const e = incidenceEntry(b, nodeId)
  const from = net.nodes.find((x) => x.id === b.fromNode)?.label
  const to = net.nodes.find((x) => x.id === b.toNode)?.label
  if (e === 1) return `+1: branch ${b.label} (${from} → ${to}) is incident at node ${n.label} and oriented away from it.`
  if (e === -1) return `−1: branch ${b.label} (${from} → ${to}) is incident at node ${n.label} and oriented towards it.`
  return `0: branch ${b.label} (${from} → ${to}) is not incident at node ${n.label}.`
}

/**
 * Number of spanning trees = det(A Aᵀ) (§17.2, Binet–Cauchy).
 * Uses the reduced incidence matrix with the last node as reference.
 */
export function countSpanningTrees(net: Network): number {
  if (net.nodes.length <= 1) return net.nodes.length
  const ref = net.nodes[net.nodes.length - 1].id
  const A = incidenceData(
    net,
    net.nodes.map((n) => n.id).filter((id) => id !== ref),
  )
  const AAT = multiply(A, transpose(A))
  return Math.round(Math.abs(det(AAT)))
}
