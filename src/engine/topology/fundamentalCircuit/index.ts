import type { Network } from '@/domain/network/types'
import type { FundamentalCircuit, LabeledMatrix, MatrixAxisEntry, SpanningTree } from '@/domain/topology/types'
import { edgesOf, findPath } from '@/engine/graph'
import { branchAxis } from '../incidence'

/**
 * Fundamental circuits (§17.5). Adding link l (a → b) to the tree closes
 * exactly one loop. Its direction of traversal agrees with the link: traverse
 * the link a → b, then the unique tree path b → a. A twig traversed along its
 * orientation enters with +1, against it with −1.
 */
export function fundamentalCircuits(net: Network, tree: SpanningTree): FundamentalCircuit[] {
  const twigs = net.branches.filter((b) => tree.twigIds.includes(b.id))
  const nodeIds = net.nodes.map((n) => n.id)
  const twigEdges = edgesOf(twigs)
  return tree.linkIds.map((linkId) => {
    const link = net.branches.find((b) => b.id === linkId)!
    const path = findPath(nodeIds, twigEdges, link.toNode, link.fromNode)
    if (!path) throw new Error(`No tree path closes link ${link.label}; the tree is invalid.`)
    const entries: FundamentalCircuit['entries'] = { [link.id]: 1 }
    const branchOrder = [link.id]
    const nodeOrder = [link.fromNode, link.toNode]
    for (const step of path) {
      entries[step.branchId] = step.forward ? 1 : -1
      branchOrder.push(step.branchId)
      if (step.to !== link.fromNode) nodeOrder.push(step.to)
    }
    return { linkId, entries, branchOrder, nodeOrder }
  })
}

/** Column order: twigs (by branch number) then links (by branch number), as in the textbook. */
export function partitionedBranchOrder(net: Network, tree: SpanningTree): string[] {
  const byIndex = (ids: string[]) =>
    [...ids].sort((a, b) => net.branches.find((x) => x.id === a)!.index - net.branches.find((x) => x.id === b)!.index)
  return [...byIndex(tree.twigIds), ...byIndex(tree.linkIds)]
}

export function treeGroup(tree: SpanningTree) {
  const twigs = new Set(tree.twigIds)
  return (id: string) => (twigs.has(id) ? 'twig' : 'link')
}

export function fcircuitAxis(net: Network, circuits: FundamentalCircuit[]): MatrixAxisEntry[] {
  return circuits.map((c) => {
    const l = net.branches.find((b) => b.id === c.linkId)!
    return { id: `fcircuit:${c.linkId}`, label: `f-circuit (${l.label})`, latex: `f_{${l.index}}`, kind: 'fcircuit', refId: c.linkId }
  })
}

/**
 * Fundamental circuit matrix Bf, (b − n + 1) × b. Rows follow the link order.
 * `order: 'natural'` keeps the branch order b1…bb; `'partitioned'` gives [B_ft | U].
 */
export function fundamentalCircuitMatrix(
  net: Network,
  tree: SpanningTree,
  circuits = fundamentalCircuits(net, tree),
  order: 'natural' | 'partitioned' = 'natural',
): LabeledMatrix {
  const cols = order === 'partitioned' ? partitionedBranchOrder(net, tree) : net.branches.map((b) => b.id)
  const linksByIndex = [...circuits].sort(
    (a, b) => net.branches.find((x) => x.id === a.linkId)!.index - net.branches.find((x) => x.id === b.linkId)!.index,
  )
  return {
    id: 'Bf',
    symbol: 'B_f',
    title: 'Fundamental circuit matrix',
    description:
      'One row per f-circuit (one per link). An entry is +1 if the branch is in the f-circuit and its orientation agrees with the traversal direction set by the link, −1 if it disagrees, and 0 otherwise.',
    kind: 'fcircuit',
    rows: fcircuitAxis(net, linksByIndex),
    cols: branchAxis(net, cols, treeGroup(tree)),
    data: linksByIndex.map((c) => cols.map((id) => c.entries[id] ?? 0)),
  }
}

export function explainFundamentalCircuitEntry(net: Network, circuit: FundamentalCircuit, branchId: string): string {
  const link = net.branches.find((b) => b.id === circuit.linkId)!
  const b = net.branches.find((x) => x.id === branchId)!
  const e = circuit.entries[branchId] ?? 0
  if (branchId === circuit.linkId) return `+1: ${b.label} is the link that defines this f-circuit; the f-circuit direction is chosen to agree with it.`
  if (e === 1) return `+1: twig ${b.label} lies on the f-circuit of link ${link.label} and is traversed along its orientation.`
  if (e === -1) return `−1: twig ${b.label} lies on the f-circuit of link ${link.label} but is traversed against its orientation.`
  return `0: ${b.label} is not part of the f-circuit of link ${link.label}.`
}
