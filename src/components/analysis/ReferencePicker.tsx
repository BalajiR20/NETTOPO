import { Crosshair, MousePointerClick } from 'lucide-react'
import type { Network } from '@/domain/network/types'
import { Button } from '@/components/ui/button'
import { WHY } from '@/engine/explanations'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import { useUiStore } from '@/store/uiStore'

export function ReferencePicker({ net }: { net: Network }) {
  const ref = useAnalysisStore((s) => s.referenceNodeId)
  const mode = useUiStore((s) => s.mode)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-refnode/40 bg-refnode/5 p-2.5" data-testid="reference-panel">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          <Crosshair className="mr-1 inline size-3.5 text-refnode" />
          Reference node
        </h4>
        <Button size="xs" variant={mode === 'reference' ? 'default' : 'outline'} onClick={() => useUiStore.getState().setMode(mode === 'reference' ? 'edit' : 'reference')}>
          <MousePointerClick /> {mode === 'reference' ? 'Cancel picking' : 'Pick on circuit'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{WHY.reference}</p>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Reference node">
        {net.nodes.map((n) => (
          <button
            key={n.id}
            type="button"
            role="radio"
            aria-checked={ref === n.id}
            onClick={() => useAnalysisStore.getState().setReference(n.id)}
            className={cn('rounded-md border px-2 py-0.5 font-mono text-xs hover:bg-muted', ref === n.id && 'border-refnode bg-refnode/15 text-refnode')}
            data-testid={`ref-${n.label}`}
          >
            {n.label}
            {n.isGround && <span className="ml-1 text-[9px] text-muted-foreground">⏚</span>}
          </button>
        ))}
      </div>
      {!ref && net.groundNodeId && <p className="text-[11px] text-muted-foreground">Tip: the ground node is a common choice.</p>}
    </div>
  )
}
