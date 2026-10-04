import type { Branch, BranchId, Network, NodeId } from '@/domain/network/types'

/**
 * Graph engine: purely structural algorithms on the oriented graph.
 * Works on any subset of branches so the topology engine can reuse it for
 * trees, co-trees and cut-set side detection.
 */

export interface Edge {
  id: BranchId
  from: NodeId
  to: NodeId
}

export interface Incidence {
  branchId: BranchId
  neighbor: NodeId
  /** True when leaving this node along the branch follows the branch orientation. */
  forward: boolean
}

export type Adjacency = Map<NodeId, Incidence[]>

export const edgesOf = (branches: Pick<Branch, 'id' | 'fromNode' | 'toNode'>[]): Edge[] =>
  branches.map((b) => ({ id: b.id, from: b.fromNode, to: b.toNode }))

export function buildAdjacency(nodeIds: NodeId[], edges: Edge[]): Adjacency {
  const adj: Adjacency = new Map(nodeIds.map((n) => [n, []]))
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    if (!adj.has(e.to)) adj.set(e.to, [])
    adj.get(e.from)!.push({ branchId: e.id, neighbor: e.to, forward: true })
    if (e.from !== e.to) adj.get(e.to)!.push({ branchId: e.id, neighbor: e.from, forward: false })
  }
  return adj
}

export function networkAdjacency(net: Network): Adjacency {
  return buildAdjacency(
    net.nodes.map((n) => n.id),
    edgesOf(net.branches),
  )
}

export function degree(net: Network, nodeId: NodeId): number {
  return net.branches.reduce((d, b) => d + (b.fromNode === nodeId ? 1 : 0) + (b.toNode === nodeId ? 1 : 0), 0)
}

export function incidentBranches(net: Network, nodeId: NodeId): Branch[] {
  return net.branches.filter((b) => b.fromNode === nodeId || b.toNode === nodeId)
}

/** Connected components (as node-id groups) of the subgraph (nodeIds, edges). */
export function connectedComponents(nodeIds: NodeId[], edges: Edge[]): NodeId[][] {
  const adj = buildAdjacency(nodeIds, edges)
  const seen = new Set<NodeId>()
  const comps: NodeId[][] = []
  for (const start of nodeIds) {
    if (seen.has(start)) continue
    const comp: NodeId[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const n = stack.pop()!
      comp.push(n)
      for (const inc of adj.get(n) ?? []) {
        if (!seen.has(inc.neighbor)) {
          seen.add(inc.neighbor)
          stack.push(inc.neighbor)
        }
      }
    }
    comps.push(comp)
  }
  return comps
}

export function isConnected(net: Network, branchIds?: BranchId[]): boolean {
  if (net.nodes.length === 0) return false
  const set = branchIds ? new Set(branchIds) : null
  const edges = edgesOf(set ? net.branches.filter((b) => set.has(b.id)) : net.branches)
  return connectedComponents(
    net.nodes.map((n) => n.id),
    edges,
  ).length === 1
}

export function componentCount(net: Network): number {
  return connectedComponents(
    net.nodes.map((n) => n.id),
    edgesOf(net.branches),
  ).length
}

export interface PathStep {
  branchId: BranchId
  /** Node the step starts at. */
  from: NodeId
  /** Node the step ends at. */
  to: NodeId
  /** True when the step follows the branch orientation. */
  forward: boolean
}

/** Shortest path (BFS, fewest branches) from `start` to `end` using only `edges`. */
export function findPath(nodeIds: NodeId[], edges: Edge[], start: NodeId, end: NodeId): PathStep[] | null {
  if (start === end) return []
  const adj = buildAdjacency(nodeIds, edges)
  const prev = new Map<NodeId, { node: NodeId; inc: Incidence }>()
  const seen = new Set([start])
  const queue = [start]
  while (queue.length) {
    const n = queue.shift()!
    for (const inc of adj.get(n) ?? []) {
      if (seen.has(inc.neighbor)) continue
      seen.add(inc.neighbor)
      prev.set(inc.neighbor, { node: n, inc })
      if (inc.neighbor === end) {
        const path: PathStep[] = []
        let cur = end
        while (cur !== start) {
          const p = prev.get(cur)!
          path.unshift({ branchId: p.inc.branchId, from: p.node, to: cur, forward: p.inc.forward })
          cur = p.node
        }
        return path
      }
      queue.push(inc.neighbor)
    }
  }
  return null
}

/**
 * Returns the branch ids of one cycle in the subgraph, or null if it is acyclic.
 * Parallel branches and self-loops count as cycles.
 */
export function findCycle(nodeIds: NodeId[], edges: Edge[]): BranchId[] | null {
  const parent = new Map<NodeId, NodeId>(nodeIds.map((n) => [n, n]))
  const find = (x: NodeId): NodeId => {
    if (!parent.has(x)) parent.set(x, x)
    while (parent.get(x) !== x) x = parent.get(x)!
    return x
  }
  const accepted: Edge[] = []
  for (const e of edges) {
    if (e.from === e.to) return [e.id]
    const ra = find(e.from)
    const rb = find(e.to)
    if (ra === rb) {
      const path = findPath(nodeIds, accepted, e.to, e.from)
      return [e.id, ...(path ?? []).map((p) => p.branchId)]
    }
    parent.set(rb, ra)
    accepted.push(e)
  }
  return null
}

export const hasCycle = (nodeIds: NodeId[], edges: Edge[]) => findCycle(nodeIds, edges) !== null

/** Breadth-first traversal order of nodes from `start` over `edges`. */
export function bfsOrder(nodeIds: NodeId[], edges: Edge[], start: NodeId): { node: NodeId; via: PathStep | null }[] {
  const adj = buildAdjacency(nodeIds, edges)
  const out: { node: NodeId; via: PathStep | null }[] = [{ node: start, via: null }]
  const seen = new Set([start])
  for (let i = 0; i < out.length; i++) {
    const n = out[i].node
    for (const inc of adj.get(n) ?? []) {
      if (seen.has(inc.neighbor)) continue
      seen.add(inc.neighbor)
      out.push({ node: inc.neighbor, via: { branchId: inc.branchId, from: n, to: inc.neighbor, forward: inc.forward } })
    }
  }
  return out
}
