import { CheckCircle2, MousePointerClick, Sparkles, Trash2 } from 'lucide-react'
import type { Network } from '@/domain/network/types'
import { Button } from '@/components/ui/button'
import { YesNo } from '@/components/common'
import { WHY } from '@/engine/explanations'
import { countSpanningTrees, validateTree } from '@/engine/topology'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import { useUiStore } from '@/store/uiStore'

/** Interactive spanning-tree selection (§17.1.1) with live validation. */
export function TreeSelectionPanel({ net, onConfirm }: { net: Network; onConfirm: () => void }) {
  const tree = useAnalysisStore((s) => s.treeBranchIds)
  const confirmed = useAnalysisStore((s) => s.treeConfirmed)
  const mode = useUiStore((s) => s.mode)
  const v = validateTree(net, tree)
  const selecting = mode === 'tree'
  const twigs = net.branches.filter((b) => tree.includes(b.id))
  const links = net.branches.filter((b) => !tree.includes(b.id))
  const total = net.branches.length <= 14 ? countSpanningTrees(net) : null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-twig/40 bg-twig/5 p-2.5" data-testid="tree-panel">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Select a spanning tree</h4>
        {selecting ? (
          <span className="inline-flex items-center gap-1 rounded bg-twig/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-twig">
            <MousePointerClick className="size-3" /> TREE SELECTION MODE
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{WHY.treeNeeded}</p>
      {!selecting && !confirmed && (
        <Button size="sm" onClick={() => useUiStore.getState().setMode('tree')} data-testid="enter-tree-mode">
          <MousePointerClick /> Enter tree selection mode
        </Button>
      )}
      {selecting && <p className="text-xs">Click branches on the circuit (or in the graph view) to toggle them as twigs.</p>}

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-md bg-card p-2 font-mono text-xs" aria-live="polite" data-testid="tree-status">
        <span className="text-muted-foreground">Selected</span>
        <span className={cn(v.selected === v.required ? 'text-pass' : 'text-foreground')}>
          {v.selected} / {v.required} required branches
        </span>
        <span className="text-muted-foreground">Nodes covered</span>
        <span className={cn(v.nodesCovered === v.totalNodes ? 'text-pass' : 'text-foreground')}>
          {v.nodesCovered} / {v.totalNodes}
        </span>
        <span className="text-muted-foreground">Connected</span>
        <YesNo ok={v.connected} />
        <span className="text-muted-foreground">Cycle</span>
        <YesNo ok={v.hasCycle} invert />
        <span className="text-muted-foreground">Tree</span>
        <span className={cn('font-semibold', v.valid ? 'text-pass' : 'text-fail')}>{v.valid ? 'VALID' : 'INVALID'}</span>
      </div>
      {!v.valid && v.issues.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-fail" role="alert">
          {v.issues.map((i) => (
            <li key={i.code}>• {i.message}</li>
          ))}
        </ul>
      )}
      {v.valid && (
        <div className="text-xs">
          <div>
            <span className="font-medium text-twig">Twigs</span> ({twigs.length}): {twigs.map((b) => `${b.label} (${b.elementLabel})`).join(', ')}
          </div>
          <div>
            <span className="font-medium text-link">Links</span> ({links.length}): {links.map((b) => `${b.label} (${b.elementLabel})`).join(', ') || 'none'}
          </div>
        </div>
      )}
      {total !== null && <p className="text-[10.5px] text-muted-foreground">This graph has det(A Aᵀ) = {total} spanning trees.</p>}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => useAnalysisStore.getState().suggestTree(net)} data-testid="suggest-tree">
          <Sparkles /> Suggest valid tree
        </Button>
        <Button size="sm" variant="ghost" onClick={() => useAnalysisStore.getState().setTree([])} disabled={!tree.length}>
          <Trash2 /> Clear
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          disabled={!v.valid}
          onClick={() => {
            useAnalysisStore.getState().confirmTree()
            useUiStore.getState().setMode('edit')
            onConfirm()
          }}
          data-testid="confirm-tree"
        >
          <CheckCircle2 /> Confirm tree & analyze
        </Button>
      </div>
    </div>
  )
}
