import { deriveNetwork, topologySignature } from '@/domain/network/derive'
import type { Network } from '@/domain/network/types'
import type { Schematic } from '@/domain/schematic/types'
import { useCircuitStore } from '@/store/circuitStore'

let cache: { s: Schematic; net: Network } | null = null

/** Memoised on schematic identity across all components (one derivation per change). */
export function getNetwork(s: Schematic): Network {
  if (cache?.s !== s) cache = { s, net: deriveNetwork(s) }
  return cache.net
}

export function useNetwork(): Network {
  const s = useCircuitStore((st) => st.schematic)
  return getNetwork(s)
}

let sigCache: { net: Network; sig: string } | null = null
export function getTopologySignature(net: Network): string {
  if (sigCache?.net !== net) sigCache = { net, sig: topologySignature(net) }
  return sigCache.sig
}
