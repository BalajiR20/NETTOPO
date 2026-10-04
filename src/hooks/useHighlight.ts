import { useMemo } from 'react'
import { resolveHighlight, type ResolvedHighlight } from '@/lib/highlight'
import { useAnalysisStore } from '@/store/analysisStore'
import { useUiStore } from '@/store/uiStore'
import { useNetwork } from './useNetwork'

/** The highlight currently active, resolved against the live network and the tree in use. */
export function useResolvedHighlight(): ResolvedHighlight | null {
  const token = useUiStore((s) => s.highlight?.token ?? null)
  const tree = useAnalysisStore((s) => s.treeBranchIds)
  const net = useNetwork()
  return useMemo(() => resolveHighlight(token, net, tree), [token, net, tree])
}
