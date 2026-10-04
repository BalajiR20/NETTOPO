import { useState } from 'react'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import type { AnalysisResult } from '@/domain/analysis/types'
import { EmptyState, SectionTitle, StatusBadge } from '@/components/common'
import { Tex } from '@/components/equations/Tex'
import { formatResidual } from '@/engine/numerical'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

export function VerificationPanel({ result }: { result: AnalysisResult | null }) {
  const [open, setOpen] = useState<string | null>('tellegen')
  const toggle = useUiStore((s) => s.toggleHighlight)
  if (!result) {
    return (
      <EmptyState title="Nothing to verify yet" icon={<ShieldCheck className="size-6" />}>
        After solving, NETTOPO substitutes the solution back into KCL, KVL, the element relations and Tellegen’s theorem, and reports each residual.
      </EmptyState>
    )
  }
  const v = result.verification
  return (
    <div className="flex flex-col gap-2 p-3">
      <SectionTitle right={<StatusBadge status={v.overall} />}>Verification — computed from the actual solution</SectionTitle>
      <ul className="flex flex-col divide-y rounded-md border" data-testid="verification-list">
        {v.checks.map((c) => {
          const isOpen = open === c.id
          return (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
                onClick={() => setOpen(isOpen ? null : c.id)}
                aria-expanded={isOpen}
              >
                <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')} aria-hidden />
                <span className="w-44 shrink-0 text-xs font-medium">{c.title}</span>
                <Tex latex={c.relation} interactive={false} className="hidden min-w-0 flex-1 truncate text-xs md:inline-block" />
                <span className="ml-auto w-40 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                  {c.residual === null ? '' : `residual ${formatResidual(c.residual)}`}
                </span>
                <StatusBadge status={c.status} className="shrink-0" />
              </button>
              {isOpen && (
                <div className="flex flex-col gap-2 bg-muted/30 px-9 py-2 text-xs">
                  <p>{c.detail}</p>
                  {c.tolerance !== null && <p className="font-mono text-[11px] text-muted-foreground">Pass tolerance: {formatResidual(c.tolerance)}</p>}
                  {c.items && (
                    <table className="w-full max-w-xl font-mono text-[11px]">
                      <tbody>
                        {c.items.map((it) => (
                          <tr key={it.label} className="border-b border-border/50">
                            <td className="py-0.5">
                              {it.ref ? (
                                <button type="button" className="hover:underline" onClick={() => toggle({ token: it.ref!, source: 'list' })}>
                                  {it.label}
                                </button>
                              ) : (
                                it.label
                              )}
                            </td>
                            {it.expression && <td className="py-0.5 text-muted-foreground">{it.expression}</td>}
                            <td className="py-0.5 text-right">{c.id === 'tellegen' ? `${Number(it.residual.toPrecision(5))} W` : formatResidual(it.residual)}</td>
                          </tr>
                        ))}
                        {c.id === 'tellegen' && (
                          <tr className="font-semibold">
                            <td className="py-0.5">Σ vₖiₖ</td>
                            <td className="py-0.5 text-right">{formatResidual(c.residual)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
