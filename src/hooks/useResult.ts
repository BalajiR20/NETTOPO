import type { AnalysisResult } from '@/domain/analysis/types'
import { useAnalysisStore } from '@/store/analysisStore'
import { getTopologySignature, useNetwork } from './useNetwork'

/** The current successful analysis result, only if it still matches the circuit topology. */
export function useResult(): AnalysisResult | null {
  const outcome = useAnalysisStore((s) => s.outcome)
  const topo = useAnalysisStore((s) => s.outcomeTopology)
  const net = useNetwork()
  if (!outcome || !outcome.ok) return null
  if (topo !== getTopologySignature(net)) return null
  return outcome
}
