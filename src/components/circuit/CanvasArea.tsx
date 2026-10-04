import { Crosshair, GitBranch, Maximize, Network as NetworkIcon, Workflow, X } from 'lucide-react'
import { ReactFlowProvider } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { GraphView } from '@/components/topology/GraphView'
import { validateTree } from '@/engine/topology'
import { useResolvedHighlight } from '@/hooks/useHighlight'
import { useNetwork } from '@/hooks/useNetwork'
import { useResult } from '@/hooks/useResult'
import { branchToken, nodeToken } from '@/lib/highlight'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import { useUiStore, type DisplayOptions } from '@/store/uiStore'
import { canvasApi } from './canvasApi'
import { CircuitCanvas } from './CircuitCanvas'

const TOGGLES: { key: keyof DisplayOptions; label: string }[] = [
  { key: 'currents', label: 'Currents' },
  { key: 'voltages', label: 'Voltages' },
  { key: 'power', label: 'Power' },
  { key: 'flow', label: 'Flow' },
]

function ModeBanner() {
  const mode = useUiStore((s) => s.mode)
  const net = useNetwork()
  const tree = useAnalysisStore((s) => s.treeBranchIds)
  if (mode === 'edit') return null
  const v = mode === 'tree' ? validateTree(net, tree) : null
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs shadow-sm backdrop-blur',
        mode === 'tree' ? 'border-twig/50 bg-twig/15' : 'border-refnode/50 bg-refnode/15',
      )}
      role="status"
      data-testid="mode-banner"
    >
      {mode === 'tree' ? <GitBranch className="size-3.5 text-twig" /> : <Crosshair className="size-3.5 text-refnode" />}
      <span className="font-semibold">{mode === 'tree' ? 'TREE SELECTION MODE' : 'REFERENCE NODE SELECTION'}</span>
      <span className="text-muted-foreground">
        {mode === 'tree'
          ? `Click branches to toggle twigs · ${v!.selected} / ${v!.required} selected · ${v!.valid ? 'tree VALID' : v!.hasCycle ? 'cycle!' : 'incomplete'}`
          : 'Click a node, ground or wire'}
      </span>
      <Button size="icon-xs" variant="ghost" onClick={() => useUiStore.getState().setMode('edit')} aria-label="Leave selection mode (Esc)">
        <X />
      </Button>
    </div>
  )
}

export function CanvasArea({ wireTool }: { wireTool: boolean }) {
  const view = useUiStore((s) => s.canvasView)
  const display = useUiStore((s) => s.display)
  const mode = useUiStore((s) => s.mode)
  const net = useNetwork()
  const result = useResult()
  const hl = useResolvedHighlight()
  const tree = useAnalysisStore((s) => s.treeBranchIds)
  const method = useAnalysisStore((s) => s.method)
  const ref = useAnalysisStore((s) => s.referenceNodeId)
  const showTree = mode === 'tree' || ((method === 'fcircuit' || method === 'loop' || method === 'fcutset' || method === 'nodePair') && tree.length > 0)

  return (
    <div className="relative h-full w-full">
      {view === 'schematic' ? (
        <ReactFlowProvider>
          <CircuitCanvas wireTool={wireTool} />
        </ReactFlowProvider>
      ) : (
        <div className="h-full w-full bg-canvas p-4" data-testid="graph-view">
          <GraphView
            net={net}
            treeBranchIds={tree}
            showTree={showTree}
            highlight={hl}
            result={result}
            referenceNodeId={ref}
            showFlow={display.flow}
            onBranchClick={(id) => {
              if (useUiStore.getState().mode === 'tree') useAnalysisStore.getState().toggleTwig(id)
              else {
                const t = branchToken(net, id)
                if (t) useUiStore.getState().toggleHighlight({ token: t, source: 'graph' })
              }
            }}
            onNodeClick={(id) => {
              if (useUiStore.getState().mode === 'reference') {
                useAnalysisStore.getState().setReference(id)
                useUiStore.getState().setMode('edit')
                return
              }
              const t = nodeToken(net, id)
              if (t) useUiStore.getState().toggleHighlight({ token: t, source: 'graph' })
            }}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start gap-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-md border bg-card/90 p-0.5 shadow-sm backdrop-blur">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && useUiStore.getState().setCanvasView(v as 'schematic' | 'graph')} size="sm" aria-label="Canvas view">
            <ToggleGroupItem value="schematic" aria-label="Schematic view" className="gap-1 px-2 text-xs">
              <Workflow className="size-3.5" /> Schematic
            </ToggleGroupItem>
            <ToggleGroupItem value="graph" aria-label="Oriented graph view" className="gap-1 px-2 text-xs" data-testid="view-graph">
              <NetworkIcon className="size-3.5" /> Graph
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border bg-card/90 p-0.5 shadow-sm backdrop-blur" role="group" aria-label="Show on circuit">
          {TOGGLES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={display[t.key]}
              disabled={!result && t.key !== 'flow'}
              onClick={() => useUiStore.getState().setDisplay({ [t.key]: !display[t.key] })}
              className={cn('rounded px-2 py-0.5 text-xs disabled:opacity-40', display[t.key] ? 'bg-accent-hl/15 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted')}
              data-testid={`toggle-${t.key}`}
            >
              {t.label}
            </button>
          ))}
          <Button size="icon-xs" variant="ghost" onClick={() => canvasApi.fitView()} aria-label="Fit to view (F)" disabled={view !== 'schematic'}>
            <Maximize />
          </Button>
        </div>
        <ModeBanner />
      </div>
      {display.flow && result && (
        <div className="pointer-events-none absolute right-2 top-12 max-w-72 rounded border bg-card/90 px-2 py-0.5 text-right text-[10.5px] text-muted-foreground" role="note">
          <b className="text-amp">Mathematical current-flow visualization</b>: direction and relative magnitude of the computed branch currents, not an electron simulation.
        </div>
      )}
      {hl && (
        <div className="pointer-events-auto absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card/95 px-3 py-0.5 text-xs shadow-sm">
          <span className="size-2 rounded-full bg-accent-hl" />
          Highlighted: <b>{hl.label}</b>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => useUiStore.getState().setHighlight(null)} aria-label="Clear highlight">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
