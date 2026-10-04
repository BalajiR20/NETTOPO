import type { Network } from '@/domain/network/types'
import { fundamentalCircuits, fundamentalCutSets, validateTree, makeTree } from '@/engine/topology'

/**
 * Resolves a highlight token (b<k> branch, n<j> node, l<k> f-circuit of link k,
 * t<k> f-cut-set of twig k) to the set of branches/nodes to emphasise.
 */
export interface ResolvedHighlight {
  token: string
  kind: 'branch' | 'node' | 'fcircuit' | 'fcutset'
  branchIds: Set<string>
  nodeIds: Set<string>
  /** ±1 per branch for f-circuits / f-cut-sets (agreement with the loop / cut-set orientation). */
  signs: Map<string, 1 | -1>
  /** f-cut-set node groups. */
  sideFrom?: Set<string>
  sideTo?: Set<string>
  /** f-circuit traversal node order. */
  nodeOrder?: string[]
  label: string
}

export function resolveHighlight(token: string | null | undefined, net: Network, treeBranchIds: string[] | null): ResolvedHighlight | null {
  if (!token) return null
  const kind = token[0]
  const k = Number(token.slice(1))
  if (!Number.isInteger(k) || k < 1) return null
  if (kind === 'b') {
    const b = net.branches[k - 1]
    if (!b) return null
    return { token, kind: 'branch', branchIds: new Set([b.id]), nodeIds: new Set(), signs: new Map(), label: `${b.label} (${b.elementLabel})` }
  }
  if (kind === 'n') {
    const n = net.nodes[k - 1]
    if (!n) return null
    return { token, kind: 'node', branchIds: new Set(), nodeIds: new Set([n.id]), signs: new Map(), label: `node ${n.label}` }
  }
  if (kind === 'l' || kind === 't') {
    const b = net.branches[k - 1]
    if (!b || !treeBranchIds || !validateTree(net, treeBranchIds).valid) return null
    const tree = makeTree(net, treeBranchIds)
    if (kind === 'l') {
      const c = fundamentalCircuits(net, tree).find((x) => x.linkId === b.id)
      if (!c) return null
      const signs = new Map(Object.entries(c.entries) as [string, 1 | -1][])
      return { token, kind: 'fcircuit', branchIds: new Set(signs.keys()), nodeIds: new Set(c.nodeOrder), signs, nodeOrder: c.nodeOrder, label: `f-circuit of link ${b.label}` }
    }
    const cs = fundamentalCutSets(net, tree).find((x) => x.twigId === b.id)
    if (!cs) return null
    const signs = new Map(Object.entries(cs.entries) as [string, 1 | -1][])
    return {
      token,
      kind: 'fcutset',
      branchIds: new Set(signs.keys()),
      nodeIds: new Set(),
      signs,
      sideFrom: new Set(cs.sideFrom),
      sideTo: new Set(cs.sideTo),
      label: `f-cut-set of twig ${b.label}`,
    }
  }
  return null
}

export const branchToken = (net: Network, branchId: string) => {
  const b = net.branches.find((x) => x.id === branchId)
  return b ? `b${b.index}` : null
}
export const nodeToken = (net: Network, nodeId: string) => {
  const i = net.nodes.findIndex((x) => x.id === nodeId)
  return i >= 0 ? `n${i + 1}` : null
}
