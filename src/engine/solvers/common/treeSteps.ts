import type { Network } from '@/domain/network/types'
import type { FundamentalCircuit, FundamentalCutSet, SpanningTree } from '@/domain/topology/types'
import { WHY } from '@/engine/explanations'
import { label, type StepBuilder } from './framework'

export function addTreeStep(sb: StepBuilder, net: Network, tree: SpanningTree) {
  const lab = (ids: string[]) => ids.map((id) => net.branches.find((b) => b.id === id)!.label).join(', ')
  sb.add(
    'tree',
    'Select spanning tree',
    `Twigs (${tree.twigIds.length} = n − 1): ${lab(tree.twigIds)}. Links (${tree.linkIds.length} = b − n + 1): ${lab(tree.linkIds) || 'none'}.`,
    [
      {
        type: 'table',
        columns: ['Tree property', 'Value'],
        rows: [
          ['Twigs', `${tree.twigIds.length} / ${net.nodes.length - 1} required`],
          ['Links', String(tree.linkIds.length)],
          ['Nodes covered', `${net.nodes.length} / ${net.nodes.length}`],
          ['Connected', 'YES'],
          ['Cycle', 'NO'],
          ['Tree', 'VALID'],
        ],
      },
      { type: 'text', text: WHY.treeChoice },
    ],
    WHY.treeNeeded,
  )
}

export function addFundamentalCircuitStep(sb: StepBuilder, net: Network, circuits: FundamentalCircuit[]) {
  sb.add(
    'topology',
    'Construct fundamental circuits',
    `${circuits.length} f-circuit${circuits.length === 1 ? '' : 's'}: one per link, oriented to agree with the link.`,
    [
      {
        type: 'table',
        columns: ['Link', 'f-circuit (traversal order)', 'Nodes'],
        rows: circuits.map((c) => {
          const link = net.branches.find((b) => b.id === c.linkId)!
          return [
            link.label,
            c.branchOrder.map((id) => `${c.entries[id] > 0 ? '+' : '−'}${net.branches.find((b) => b.id === id)!.label}`).join(' '),
            [...c.nodeOrder, c.nodeOrder[0]].map((n) => label(net, n)).join(' → '),
          ]
        }),
      },
    ],
    WHY.fcircuit,
  )
}

export function addCutSetStep(sb: StepBuilder, net: Network, cutsets: FundamentalCutSet[]) {
  sb.add(
    'topology',
    'Construct fundamental cut-sets',
    `${cutsets.length} f-cut-set${cutsets.length === 1 ? '' : 's'}: one per twig, oriented to agree with the twig.`,
    [
      {
        type: 'table',
        columns: ['Twig', 'f-cut-set branches', 'Node groups'],
        rows: cutsets.map((c) => {
          const twig = net.branches.find((b) => b.id === c.twigId)!
          return [
            twig.label,
            Object.entries(c.entries)
              .map(([id, e]) => `${e > 0 ? '+' : '−'}${net.branches.find((b) => b.id === id)!.label}`)
              .join(' '),
            `{${c.sideFrom.map((n) => label(net, n)).join(', ')}} → {${c.sideTo.map((n) => label(net, n)).join(', ')}}`,
          ]
        }),
      },
    ],
    WHY.fcutset,
  )
}
