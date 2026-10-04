import { Sigma } from 'lucide-react'
import type { AnalysisResult, EquationGroup } from '@/domain/analysis/types'
import { EmptyState, SectionTitle } from '@/components/common'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'
import { Tex } from './Tex'

export function EquationGroupView({ group, compact = false }: { group: EquationGroup; compact?: boolean }) {
  const token = useUiStore((s) => s.highlight?.token ?? null)
  const toggle = useUiStore((s) => s.toggleHighlight)
  return (
    <section className="flex flex-col gap-1" aria-label={group.title}>
      {!compact && (
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h4 className="text-xs font-semibold">{group.title}</h4>
          <Tex latex={group.matrixForm} className="text-sm" />
        </div>
      )}
      {!compact && <p className="text-xs text-muted-foreground">{group.description}</p>}
      <ol className="flex flex-col">
        {group.equations.map((eq, k) => (
          <li
            key={eq.id}
            className={cn('group flex items-start gap-2 rounded px-1.5 py-0.5 hover:bg-muted/60', eq.ref && eq.ref === token && 'bg-accent-hl/10')}
          >
            <button
              type="button"
              className="mt-0.5 w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => eq.ref && toggle({ token: eq.ref, source: 'equation' })}
              aria-label={`Highlight what equation ${k + 1} refers to`}
              disabled={!eq.ref}
            >
              ({k + 1})
            </button>
            <div className="min-w-0 flex-1">
              <Tex latex={eq.latex} className="max-w-full overflow-x-auto" label={eq.origin} />
              <div className="text-[10.5px] text-muted-foreground">{eq.origin}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function EquationsPanel({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <EmptyState title="No equations yet" icon={<Sigma className="size-6" />}>
        Equations are generated only after you choose a method and run it. Click any variable, such as i₂, to highlight its branch on the circuit.
      </EmptyState>
    )
  }
  return (
    <div className="flex flex-col gap-4 p-3">
      <SectionTitle>Equations — click a variable to highlight it on the circuit</SectionTitle>
      {result.equationGroups.map((g) => (
        <EquationGroupView key={g.id} group={g} />
      ))}
    </div>
  )
}
