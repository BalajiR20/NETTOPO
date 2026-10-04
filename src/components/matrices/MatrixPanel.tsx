import { useState } from 'react'
import { Grid3x3 } from 'lucide-react'
import type { AnalysisResult } from '@/domain/analysis/types'
import { EmptyState } from '@/components/common'
import { Tex } from '@/components/equations/Tex'
import { cn } from '@/lib/utils'
import { MatrixTable } from './MatrixTable'

export function MatrixPanel({ result }: { result: AnalysisResult | null }) {
  const [active, setActive] = useState<string | null>(null)
  if (!result) {
    return (
      <EmptyState title="No matrices yet" icon={<Grid3x3 className="size-6" />}>
        NETTOPO builds only the matrices your chosen method needs: A for nodal analysis, Bf for loop analysis, Qf for node-pair analysis.
      </EmptyState>
    )
  }
  const current = result.matrices.find((m) => m.id === active) ?? result.matrices[0]
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Matrices">
        {result.matrices.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={m.id === current.id}
            onClick={() => setActive(m.id)}
            className={cn('rounded-md border px-2 py-1 text-xs', m.id === current.id ? 'border-accent-hl bg-accent-hl/10' : 'hover:bg-muted')}
          >
            <Tex latex={m.symbol} interactive={false} /> <span className="ml-1 text-muted-foreground">{m.title}</span>
          </button>
        ))}
      </div>
      <MatrixTable key={current.id} matrix={current} net={result.networkSnapshot} result={result} />
      <p className="text-[11px] text-muted-foreground">Click a column header to highlight its branch, a row header to highlight its node / f-circuit / f-cut-set, or any entry to see why it has that value.</p>
    </div>
  )
}
