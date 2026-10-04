import type { AnalysisOutcome, AnalysisResult } from '@/domain/analysis/types'
import { deriveNetwork } from '@/domain/network/derive'
import type { Network } from '@/domain/network/types'
import { schematicFromGraph, type GraphSpec } from '@/domain/schematic/fromGraph'

export const netFrom = (spec: GraphSpec) => deriveNetwork(schematicFromGraph(spec))

export const nodeId = (net: Network, label: string) => {
  const n = net.nodes.find((x) => x.label === label)
  if (!n) throw new Error(`no node ${label}`)
  return n.id
}

/** Branch by element label (R1, V1, …) or branch label (b3). */
export const br = (net: Network, label: string) => {
  const b = net.branches.find((x) => x.elementLabel === label || x.label === label)
  if (!b) throw new Error(`no branch ${label}`)
  return b
}

export const branchIds = (net: Network, labels: string[]) => labels.map((l) => br(net, l).id)

export function expectOk(o: AnalysisOutcome): AnalysisResult {
  if (!o.ok) throw new Error(`analysis failed: ${o.errors.map((e) => e.message).join('; ')}`)
  return o
}

export const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))
