import { toast } from 'sonner'
import { METHODS } from '@/domain/analysis/methods'
import type { AnalysisOutcome } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import { useAnalysisStore } from '@/store/analysisStore'

export function announceOutcome(o: AnalysisOutcome | null) {
  if (!o) return
  if (o.ok) {
    const c = (id: string) => o.verification.checks.find((x) => x.id === id)?.status
    const mark = (s?: string) => (s === 'pass' ? '✓' : s === 'warning' ? '!' : '✗')
    toast.success(`${METHODS[o.method].title} solved`, { description: `KCL ${mark(c('kcl'))}  KVL ${mark(c('kvl'))}  Tellegen ${mark(c('tellegen'))}` })
  } else {
    toast.error(o.errors[0]?.message ?? 'Analysis failed')
  }
}

export function runCurrentAnalysis(net: Network) {
  const out = useAnalysisStore.getState().run(net)
  announceOutcome(out)
  return out
}
