import type { Branch, BranchId, Network } from '@/domain/network/types'
import type { SpanningTree, TreeValidation } from '@/domain/topology/types'
import { connectedComponents, edgesOf, findCycle, findPath } from '@/engine/graph'

/**
 * Tree engine (§17.1.1). A tree is a connected subgraph containing all nodes
 * and no loops; it has exactly n − 1 twigs.
 */

export function validateTree(net: Network, branchIds: BranchId[]): TreeValidation {
  const n = net.nodes.length
  const required = Math.max(n - 1, 0)
  const issues: TreeValidation['issues'] = []
  const known = new Map(net.branches.map((b) => [b.id, b]))
  const unknown = branchIds.filter((id) => !known.has(id))
  if (unknown.length) issues.push({ code: 'unknown-branch', message: `Unknown branch id(s): ${unknown.join(', ')}.` })
  const selected = [...new Set(branchIds.filter((id) => known.has(id)))].map((id) => known.get(id)!)
  const nodeIds = net.nodes.map((x) => x.id)
  const edges = edgesOf(selected)

  const covered = new Set<string>()
  for (const b of selected) {
    covered.add(b.fromNode)
    covered.add(b.toNode)
  }
  if (n === 1) covered.add(nodeIds[0])

  const cycle = findCycle(nodeIds, edges)
  const touched = nodeIds.filter((id) => covered.has(id))
  const comps = touched.length ? connectedComponents(touched, edges) : []
  const connected = comps.length <= 1

  if (cycle) {
    const labels = cycle.map((id) => known.get(id)!.label).join(', ')
    issues.push({ code: 'cycle', message: `A tree cannot contain a cycle: ${labels} form a loop. Deselect one of them.` })
  }
  if (selected.length < required && !cycle) {
    const k = required - selected.length
    issues.push({
      code: 'too-few',
      message: `Select ${k === 1 ? 'one more branch' : `${k} more branches`} to include all nodes (a tree of ${n} nodes has ${required} twigs).`,
    })
  }
  if (selected.length > required) {
    const k = selected.length - required
    issues.push({ code: 'too-many', message: `A tree of ${n} nodes has exactly ${required} twigs. Remove ${k} branch${k === 1 ? '' : 'es'}.` })
  }
  const missing = net.nodes.filter((x) => !covered.has(x.id))
  if (missing.length && selected.length >= required) {
    issues.push({ code: 'nodes-missing', message: `Nodes not reached by the tree: ${missing.map((m) => m.label).join(', ')}.` })
  }
  if (!connected && !cycle) {
    issues.push({ code: 'disconnected', message: `The selected branches form ${comps.length} separate pieces; a tree must be connected.` })
  }

  const valid = !unknown.length && !cycle && connected && selected.length === required && covered.size === n
  return {
    valid,
    selected: selected.length,
    required,
    nodesCovered: covered.size,
    totalNodes: n,
    connected: connected && touched.length > 0,
    hasCycle: !!cycle,
    cycleBranchIds: cycle ?? [],
    issues: valid ? [] : issues,
  }
}

export const isValidTree = (net: Network, branchIds: BranchId[]) => validateTree(net, branchIds).valid

export function getTwigs(net: Network, treeBranchIds: BranchId[]): Branch[] {
  const set = new Set(treeBranchIds)
  return net.branches.filter((b) => set.has(b.id))
}

export function getLinks(net: Network, treeBranchIds: BranchId[]): Branch[] {
  const set = new Set(treeBranchIds)
  return net.branches.filter((b) => !set.has(b.id))
}

export function makeTree(net: Network, treeBranchIds: BranchId[]): SpanningTree {
  return { twigIds: getTwigs(net, treeBranchIds).map((b) => b.id), linkIds: getLinks(net, treeBranchIds).map((b) => b.id) }
}

/**
 * Branch priority for a "proper" tree (§17.3.1, §17.6.1): voltage sources
 * should be twigs and current sources links. Lower = earlier.
 */
const PRIORITY: Record<string, number> = { voltageSource: 0, resistor: 1, currentSource: 2 }

/**
 * Suggests a spanning tree with Kruskal's algorithm. Branches are visited by
 * priority (V-sources, resistors, I-sources), then by branch number. This
 * reproduces the textbook's polling construction (§17.1.1) and always gives a
 * tree that contains every voltage source and no current source whenever one
 * exists.
 */
export function suggestSpanningTree(net: Network, opts: { prefer?: 'proper' | 'index' } = {}): SpanningTree | null {
  const sorted = [...net.branches].sort((a, b) =>
    opts.prefer === 'index' ? a.index - b.index : PRIORITY[a.element.type] - PRIORITY[b.element.type] || a.index - b.index,
  )
  const parent = new Map(net.nodes.map((n) => [n.id, n.id]))
  const find = (x: string): string => {
    while (parent.get(x) !== x) x = parent.get(x)!
    return x
  }
  const twigs: BranchId[] = []
  for (const b of sorted) {
    const ra = find(b.fromNode)
    const rb = find(b.toNode)
    if (ra === rb) continue
    parent.set(rb, ra)
    twigs.push(b.id)
  }
  if (twigs.length !== net.nodes.length - 1) return null
  return makeTree(net, twigs)
}

/**
 * Enumerates spanning trees by backtracking (include/exclude each branch,
 * pruning on cycles). Bounded by `limit` because the count grows quickly.
 */
export function findSpanningTrees(net: Network, limit = 1000): BranchId[][] {
  const n = net.nodes.length
  const need = n - 1
  const out: BranchId[][] = []
  const branches = net.branches.filter((b) => b.fromNode !== b.toNode)
  const chosen: Branch[] = []

  const rec = (i: number) => {
    if (out.length >= limit) return
    if (chosen.length === need) {
      if (connectedComponents(
        net.nodes.map((x) => x.id),
        edgesOf(chosen),
      ).length === 1)
        out.push(chosen.map((b) => b.id))
      return
    }
    if (branches.length - i < need - chosen.length) return
    const b = branches[i]
    // include
    if (!findPath(
      net.nodes.map((x) => x.id),
      edgesOf(chosen),
      b.fromNode,
      b.toNode,
    )) {
      chosen.push(b)
      rec(i + 1)
      chosen.pop()
    }
    // exclude
    rec(i + 1)
  }
  if (n >= 1) rec(0)
  return out
}

export interface WellPosedness {
  ok: boolean
  /** Voltage sources that could not be placed in a tree (they close a loop of V-sources). */
  voltageSourceLoop: BranchId[]
  /** Current sources forced into every tree (they form a cut-set of I-sources). */
  currentSourceCutset: BranchId[]
  messages: string[]
}

/**
 * Necessary condition for a unique solution (§17.3.1 and §17.6.1): there must
 * be a tree that contains every independent voltage source and no
 * independent current source.
 */
export function checkWellPosedness(net: Network): WellPosedness {
  const tree = suggestSpanningTree(net)
  const messages: string[] = []
  if (!tree) return { ok: false, voltageSourceLoop: [], currentSourceCutset: [], messages: ['The graph is not connected.'] }
  const twigSet = new Set(tree.twigIds)
  const vs = net.branches.filter((b) => b.element.type === 'voltageSource')
  const missingV = vs.filter((b) => !twigSet.has(b.id))
  const forcedI = net.branches.filter((b) => b.element.type === 'currentSource' && twigSet.has(b.id))

  const voltageSourceLoop: BranchId[] = []
  const currentSourceCutset: BranchId[] = []
  for (const b of missingV) {
    const vTwigs = net.branches.filter((x) => x.element.type === 'voltageSource' && twigSet.has(x.id))
    const path = findPath(
      net.nodes.map((x) => x.id),
      edgesOf(vTwigs),
      b.fromNode,
      b.toNode,
    )
    const loop = [b.id, ...(path ?? []).map((p) => p.branchId)]
    voltageSourceLoop.push(...loop)
    messages.push(
      `Voltage sources ${loop.map((id) => net.branches.find((x) => x.id === id)!.elementLabel).join(', ')} form a loop containing only voltage sources (KVL would fix one source voltage from the others).`,
    )
  }
  for (const b of forcedI) {
    // Cut-set of the forced twig: components of the tree minus this twig.
    const others = tree.twigIds.filter((id) => id !== b.id)
    const comps = connectedComponents(
      net.nodes.map((x) => x.id),
      edgesOf(net.branches.filter((x) => others.includes(x.id))),
    )
    const side = new Set(comps.find((c) => c.includes(b.fromNode)))
    const cut = net.branches.filter((x) => side.has(x.fromNode) !== side.has(x.toNode))
    currentSourceCutset.push(...cut.map((x) => x.id))
    messages.push(
      `Current sources ${cut.map((x) => x.elementLabel).join(', ')} form a cut-set containing only current sources (KCL would fix one source current from the others).`,
    )
  }
  return {
    ok: missingV.length === 0 && forcedI.length === 0,
    voltageSourceLoop: [...new Set(voltageSourceLoop)],
    currentSourceCutset: [...new Set(currentSourceCutset)],
    messages,
  }
}
