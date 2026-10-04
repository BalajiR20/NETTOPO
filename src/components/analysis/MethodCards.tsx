import { GitBranch, Crosshair } from 'lucide-react'
import { METHOD_ORDER, METHODS } from '@/domain/analysis/methods'
import type { MethodId } from '@/domain/analysis/types'
import { Tex } from '@/components/equations/Tex'
import { cn } from '@/lib/utils'

export function MethodCards({ selected, onSelect, columns = 1 }: { selected: MethodId | null; onSelect: (m: MethodId) => void; columns?: 1 | 2 | 3 }) {
  return (
    <div className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3')} role="radiogroup" aria-label="Analysis method">
      {METHOD_ORDER.map((id) => {
        const m = METHODS[id]
        const active = selected === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(id)}
            className={cn(
              'flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-accent-hl/60 hover:bg-accent-hl/5',
              active && 'border-accent-hl bg-accent-hl/10 ring-1 ring-accent-hl',
            )}
            data-testid={`method-${id}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{m.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{m.section}</span>
            </div>
            <p className="text-xs text-muted-foreground">{m.description}</p>
            <Tex latex={m.coreEquation} interactive={false} className="text-xs" />
            <div className="flex flex-wrap gap-1.5 text-[10.5px]">
              <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5', m.requiresReference ? 'border-refnode/40 text-refnode' : 'text-muted-foreground')}>
                <Crosshair className="size-3" aria-hidden /> Reference node: {m.requiresReference ? 'required' : 'not required'}
              </span>
              <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5', m.requiresTree ? 'border-twig/40 text-twig' : 'text-muted-foreground')}>
                <GitBranch className="size-3" aria-hidden /> Spanning tree: {m.requiresTree ? 'required' : 'not required'}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
