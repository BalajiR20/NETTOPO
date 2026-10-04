import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { METHODS } from '@/domain/analysis/methods'
import type { AnalysisResult } from '@/domain/analysis/types'
import { StatusBadge } from '@/components/common'
import { Tex } from '@/components/equations/Tex'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { formatSI } from '@/engine/numerical'
import { validateTree } from '@/engine/topology'
import { useResolvedHighlight } from '@/hooks/useHighlight'
import { useNetwork } from '@/hooks/useNetwork'
import { branchToken, nodeToken } from '@/lib/highlight'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import { useUiStore, type DisplayOptions } from '@/store/uiStore'
import { GraphView } from './GraphView'

type StageId = 'circuit' | 'graph' | 'elements' | 'tree' | 'twigs' | 'fundamental' | 'matrices' | 'equations' | 'solution' | 'verification' | 'visualization'
type StageState = 'done' | 'pending' | 'skip'

const STAGES: { id: StageId; title: string }[] = [
  { id: 'circuit', title: 'Circuit' },
  { id: 'graph', title: 'Oriented graph' },
  { id: 'elements', title: 'Nodes + branches' },
  { id: 'tree', title: 'Tree' },
  { id: 'twigs', title: 'Twigs + links' },
  { id: 'fundamental', title: 'f-circuits / f-cut-sets' },
  { id: 'matrices', title: 'Matrices' },
  { id: 'equations', title: 'Equations' },
  { id: 'solution', title: 'Solution' },
  { id: 'verification', title: 'Verification' },
  { id: 'visualization', title: 'Visualization' },
]

export function TopologyExplorer({ result }: { result: AnalysisResult | null }) {
  const net = useNetwork()
  const method = useAnalysisStore((s) => s.method)
  const tree = useAnalysisStore((s) => s.treeBranchIds)
  const mode = useUiStore((s) => s.mode)
  const display = useUiStore((s) => s.display)
  const hl = useResolvedHighlight()
  const ref = useAnalysisStore((s) => s.referenceNodeId)
  const [stage, setStage] = useState<StageId>('graph')
  const info = method ? METHODS[method] : null
  const needsTree = !!info?.requiresTree
  const tv = validateTree(net, tree)

  const stateOf = (id: StageId): StageState => {
    switch (id) {
      case 'circuit':
      case 'graph':
      case 'elements':
        return net.branches.length ? 'done' : 'pending'
      case 'tree':
      case 'twigs':
        return info && !needsTree ? 'skip' : tv.valid ? 'done' : 'pending'
      case 'fundamental':
        return info && !needsTree ? 'skip' : result?.tree?.fundamentalCircuits || result?.tree?.fundamentalCutSets ? 'done' : 'pending'
      default:
        return result ? 'done' : 'pending'
    }
  }

  const showTree = needsTree || mode === 'tree'
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="topology-explorer">
      <nav className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b px-2 py-1.5" aria-label="Topology pipeline">
        {STAGES.map((s, i) => {
          const st = stateOf(s.id)
          return (
            <div key={s.id} className="flex shrink-0 items-center">
              {i > 0 && <ChevronRight className="size-3 text-muted-foreground" aria-hidden />}
              <button
                type="button"
                onClick={() => setStage(s.id)}
                aria-current={stage === s.id ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]',
                  stage === s.id ? 'bg-accent-hl/15 font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted',
                  st === 'skip' && 'line-through opacity-60',
                )}
                title={st === 'skip' ? `Not required for ${info?.title}` : st === 'pending' ? 'Not computed yet' : 'Available'}
              >
                <span className={cn('size-1.5 rounded-full', st === 'done' ? 'bg-pass' : st === 'skip' ? 'bg-muted-foreground/40' : 'bg-warn')} />
                {s.title}
              </button>
            </div>
          )
        })}
      </nav>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(240px,40%)_1fr]">
        <div className="relative min-h-48 border-b md:border-r md:border-b-0">
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
          <span className="absolute left-2 top-1.5 text-[10.5px] font-medium text-muted-foreground">Linear oriented graph {showTree && '· solid = twig, dashed = link'}</span>
          {hl && <span className="absolute bottom-1.5 left-2 rounded bg-accent-hl/15 px-1.5 text-[10.5px]">Highlighted: {hl.label}</span>}
        </div>
        <div className="min-h-0 overflow-auto p-3 text-xs">
          <StageBody stage={stage} result={result} display={display} needsTree={needsTree} />
        </div>
      </div>
    </div>
  )
}

function StageBody({ stage, result, display, needsTree }: { stage: StageId; result: AnalysisResult | null; display: DisplayOptions; needsTree: boolean }) {
  const net = useNetwork()
  const method = useAnalysisStore((s) => s.method)
  const tree = useAnalysisStore((s) => s.treeBranchIds)
  const toggle = useUiStore((s) => s.toggleHighlight)
  const info = method ? METHODS[method] : null
  const lbl = (id: string) => net.nodes.find((n) => n.id === id)?.label ?? id
  const notRequired = info && !needsTree
  const pending = (what: string) => <p className="text-muted-foreground">{what}</p>

  switch (stage) {
    case 'circuit':
      return (
        <div className="flex flex-col gap-1">
          <p>
            The schematic contains {net.branches.length} two-terminal elements. NETTOPO replaces each element by a branch and each group of wired terminals by a node (§17.1).
          </p>
          <p className="text-muted-foreground">Only general network information is computed while you edit. Method-specific mathematics waits until you choose a method.</p>
        </div>
      )
    case 'graph':
      return (
        <div className="flex flex-col gap-1.5">
          <p>
            The oriented graph has <b>n = {net.nodes.length}</b> nodes and <b>b = {net.branches.length}</b> branches. Each arrow is a current reference direction; the voltage follows the passive sign convention.
          </p>
          <p className="text-muted-foreground">Click a branch or node in the graph to highlight it on the circuit, in the matrices and in the equations.</p>
          <Tex latex={`\\text{twigs per tree} = n-1 = ${net.nodes.length - 1},\\quad \\text{links} = b-n+1 = ${net.branches.length - net.nodes.length + 1}`} />
        </div>
      )
    case 'elements':
      return (
        <table className="w-full font-mono">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-0.5 font-medium">Branch</th>
              <th className="font-medium">Element</th>
              <th className="font-medium">From → To</th>
              <th className="font-medium">Variables</th>
            </tr>
          </thead>
          <tbody>
            {net.branches.map((b) => (
              <tr key={b.id} className="border-b border-border/50">
                <td className="py-0.5">
                  <button type="button" className="hover:underline" onClick={() => toggle({ token: `b${b.index}`, source: 'list' })}>
                    {b.label}
                  </button>
                </td>
                <td>{b.elementLabel}</td>
                <td>
                  {lbl(b.fromNode)} → {lbl(b.toNode)}
                </td>
                <td>
                  i{b.index}, v{b.index}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'tree':
    case 'twigs': {
      if (notRequired) return pending(`${info!.title} does not need a spanning tree, so none is built (lazy analysis).`)
      const v = validateTree(net, tree)
      if (!v.valid) return pending('No valid spanning tree selected yet. Choose a tree-based method (Bf, loop, Qf or node-pair) and select a tree in the Analysis panel.')
      return (
        <div className="flex flex-col gap-1">
          <p>
            <span className="font-semibold text-twig">Twigs</span>: {net.branches.filter((b) => tree.includes(b.id)).map((b) => b.label).join(', ')}
          </p>
          <p>
            <span className="font-semibold text-link">Links</span>: {net.branches.filter((b) => !tree.includes(b.id)).map((b) => b.label).join(', ') || 'none'}
          </p>
          <p className="text-muted-foreground">A tree contains every node and no loop; it always has n − 1 twigs (§17.1.1).</p>
        </div>
      )
    }
    case 'fundamental': {
      if (notRequired) return pending(`${info!.title} does not use fundamental circuits or cut-sets.`)
      const fc = result?.tree?.fundamentalCircuits
      const cs = result?.tree?.fundamentalCutSets
      if (!fc && !cs) return pending('Generated after the tree is confirmed and the method runs.')
      return (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground">Click one to highlight it on the circuit and in the graph (±1 marks agreement with its orientation).</p>
          {fc?.map((c) => {
            const l = net.branches.find((b) => b.id === c.linkId)!
            return (
              <button key={c.linkId} type="button" className="rounded border px-2 py-1 text-left font-mono hover:bg-muted" onClick={() => toggle({ token: `l${l.index}`, source: 'list' })}>
                f-circuit of link {l.label}: {c.branchOrder.map((id) => `${c.entries[id] > 0 ? '+' : '−'}${net.branches.find((b) => b.id === id)!.label}`).join(' ')}
              </button>
            )
          })}
          {cs?.map((c) => {
            const t = net.branches.find((b) => b.id === c.twigId)!
            return (
              <button key={c.twigId} type="button" className="rounded border px-2 py-1 text-left font-mono hover:bg-muted" onClick={() => toggle({ token: `t${t.index}`, source: 'list' })}>
                f-cut-set of twig {t.label}: {Object.entries(c.entries).map(([id, e]) => `${e > 0 ? '+' : '−'}${net.branches.find((b) => b.id === id)!.label}`).join(' ')}
              </button>
            )
          })}
        </div>
      )
    }
    case 'matrices':
      if (!result) return pending('Matrices are built only for the selected method, after it runs.')
      return (
        <div className="flex flex-col gap-1">
          {result.matrices.map((m) => (
            <button key={m.id} type="button" className="flex items-center gap-2 rounded border px-2 py-1 text-left hover:bg-muted" onClick={() => useUiStore.getState().setBottomTab('matrix')}>
              <Tex latex={m.symbol} interactive={false} />
              <span>{m.title}</span>
              <span className="ml-auto font-mono text-muted-foreground">
                {m.rows.length}×{m.cols.length}
              </span>
            </button>
          ))}
        </div>
      )
    case 'equations':
      if (!result) return pending('Equations are generated after the method runs.')
      return (
        <div className="flex flex-col gap-1">
          {result.equationGroups.map((g) => (
            <button key={g.id} type="button" className="flex items-center gap-2 rounded border px-2 py-1 text-left hover:bg-muted" onClick={() => useUiStore.getState().setBottomTab('equations')}>
              <span>{g.title}</span>
              <Tex latex={g.matrixForm} interactive={false} />
              <span className="ml-auto font-mono text-muted-foreground">{g.equations.length} eq.</span>
            </button>
          ))}
        </div>
      )
    case 'solution':
      if (!result) return pending('Not solved yet.')
      return (
        <div className="flex flex-col gap-1">
          {result.primary.map((p) => (
            <div key={p.v.text} className="flex justify-between font-mono">
              <Tex latex={p.v.latex} interactive={false} />
              <span>{formatSI(p.value, p.v.unit, 4)}</span>
            </div>
          ))}
          <button type="button" className="mt-1 self-start text-accent-hl hover:underline" onClick={() => useUiStore.getState().setBottomTab('results')}>
            Open full results →
          </button>
        </div>
      )
    case 'verification':
      if (!result) return pending('Verification runs after solving.')
      return (
        <div className="flex flex-col gap-1">
          {result.verification.checks.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2">
              <span>{c.title}</span>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      )
    case 'visualization':
      return (
        <div className="flex flex-col gap-2">
          {(['currents', 'voltages', 'power', 'flow'] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <Switch id={`viz-${k}`} checked={display[k]} onCheckedChange={(v) => useUiStore.getState().setDisplay({ [k]: v })} />
              <Label htmlFor={`viz-${k}`} className="text-xs">
                {k === 'flow' ? 'Current flow (mathematical visualization)' : `Show ${k}`}
              </Label>
            </div>
          ))}
          <button type="button" className="self-start text-accent-hl hover:underline" onClick={() => useUiStore.getState().setBottomTab('oscilloscope')}>
            Open oscilloscope →
          </button>
        </div>
      )
  }
}
