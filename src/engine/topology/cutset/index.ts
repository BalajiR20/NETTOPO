import type { Network } from '@/domain/network/types'
import type { FundamentalCutSet, LabeledMatrix, MatrixAxisEntry, SpanningTree } from '@/domain/topology/types'
import { connectedComponents, edgesOf } from '@/engine/graph'
import { branchAxis } from '../incidence'
import { partitionedBranchOrder, treeGroup } from '../fundamentalCircuit'

/**
 * Fundamental cut-sets (§17.8.4). Removing twig t (a → b) splits the tree into
 * two node groups. The twig plus every link joining the groups is the
 * f-cut-set of t, oriented to agree with the twig (from a's side to b's side).
 */
export function fundamentalCutSets(net: Network, tree: SpanningTree): FundamentalCutSet[] {
  const nodeIds = net.nodes.map((n) => n.id)
  return tree.twigIds.map((twigId) => {
    const twig = net.branches.find((b) => b.id === twigId)!
    const rest = net.branches.filter((b) => tree.twigIds.includes(b.id) && b.id !== twigId)
    const comps = connectedComponents(nodeIds, edgesOf(rest))
    const sideFrom = comps.find((c) => c.includes(twig.fromNode)) ?? [twig.fromNode]
    const fromSet = new Set(sideFrom)
    const sideTo = nodeIds.filter((id) => !fromSet.has(id))
    const entries: FundamentalCutSet['entries'] = {}
    for (const b of net.branches) {
      const fIn = fromSet.has(b.fromNode)
      const tIn = fromSet.has(b.toNode)
      if (fIn && !tIn) entries[b.id] = 1
      else if (!fIn && tIn) entries[b.id] = -1
    }
    return { twigId, entries, sideFrom, sideTo }
  })
}

export function fcutsetAxis(net: Network, cutsets: FundamentalCutSet[]): MatrixAxisEntry[] {
  return cutsets.map((c) => {
    const t = net.branches.find((b) => b.id === c.twigId)!
    return { id: `fcutset:${c.twigId}`, label: `f-cut-set (${t.label})`, latex: `c_{${t.index}}`, kind: 'fcutset', refId: c.twigId }
  })
}

/** Fundamental cut-set matrix Qf, (n − 1) × b. Rows follow the twig order. */
export function fundamentalCutSetMatrix(
  net: Network,
  tree: SpanningTree,
  cutsets = fundamentalCutSets(net, tree),
  order: 'natural' | 'partitioned' = 'natural',
): LabeledMatrix {
  const cols = order === 'partitioned' ? partitionedBranchOrder(net, tree) : net.branches.map((b) => b.id)
  const sorted = [...cutsets].sort(
    (a, b) => net.branches.find((x) => x.id === a.twigId)!.index - net.branches.find((x) => x.id === b.twigId)!.index,
  )
  return {
    id: 'Qf',
    symbol: 'Q_f',
    title: 'Fundamental cut-set matrix',
    description:
      'One row per f-cut-set (one per twig). An entry is +1 if the branch is in the cut-set and its orientation agrees with the cut-set orientation set by the twig, −1 if it disagrees, and 0 otherwise.',
    kind: 'fcutset',
    rows: fcutsetAxis(net, sorted),
    cols: branchAxis(net, cols, treeGroup(tree)),
    data: sorted.map((c) => cols.map((id) => c.entries[id] ?? 0)),
  }
}

export function explainCutSetEntry(net: Network, cutset: FundamentalCutSet, branchId: string): string {
  const twig = net.branches.find((b) => b.id === cutset.twigId)!
  const b = net.branches.find((x) => x.id === branchId)!
  const e = cutset.entries[branchId] ?? 0
  const label = (ids: string[]) => ids.map((id) => net.nodes.find((n) => n.id === id)?.label).join(', ')
  if (branchId === cutset.twigId) return `+1: ${b.label} is the twig that defines this f-cut-set; the cut-set is oriented to agree with it ({${label(cutset.sideFrom)}} → {${label(cutset.sideTo)}}).`
  if (e === 1) return `+1: link ${b.label} crosses the cut from {${label(cutset.sideFrom)}} to {${label(cutset.sideTo)}}, agreeing with twig ${twig.label}.`
  if (e === -1) return `−1: link ${b.label} crosses the cut from {${label(cutset.sideTo)}} to {${label(cutset.sideFrom)}}, opposing twig ${twig.label}.`
  return `0: ${b.label} does not cross the cut defined by twig ${twig.label}.`
}
