import { AlertCircle, ArrowLeftRight, GitBranch, Info, Pencil, Play, RefreshCw } from 'lucide-react'
import { METHODS } from '@/domain/analysis/methods'
import { blockingIssues } from '@/domain/network/derive'
import { Button } from '@/components/ui/button'
import { SectionTitle, StatusBadge } from '@/components/common'
import { Tex } from '@/components/equations/Tex'
import { METHOD_WHY } from '@/engine/explanations'
import { useNetwork } from '@/hooks/useNetwork'
import { useResult } from '@/hooks/useResult'
import { analysisPhase, useAnalysisStore } from '@/store/analysisStore'
import { useUiStore } from '@/store/uiStore'
import { MethodCards } from './MethodCards'
import { ReferencePicker } from './ReferencePicker'
import { StepsView } from './StepsView'
import { TreeSelectionPanel } from './TreeSelectionPanel'
import { runCurrentAnalysis } from './run'

export function AnalysisPanel() {
  const net = useNetwork()
  const st = useAnalysisStore()
  const phase = analysisPhase(st)
  const result = useResult()
  const blocking = blockingIssues(net)
  const info = st.method ? METHODS[st.method] : null
  const outcome = st.outcome && st.outcome.method === st.method ? st.outcome : null
  const canRun = !!st.method && (phase === 'ready' || phase === 'solved' || phase === 'failed') && blocking.length === 0

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="analysis-panel">
      {blocking.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-fail/40 bg-fail/5 p-2 text-xs" role="alert">
          <span className="font-semibold text-fail">
            <AlertCircle className="mr-1 inline size-3.5" />
            The circuit cannot be analysed yet
          </span>
          {blocking.map((i, k) => (
            <div key={k}>
              {i.message} {i.hint && <span className="text-muted-foreground">{i.hint}</span>}
            </div>
          ))}
        </div>
      )}

      {st.invalidationNotice && (
        <div className="flex gap-2 rounded-md border border-warn/40 bg-warn/5 p-2 text-xs" role="status">
          <RefreshCw className="size-3.5 shrink-0 text-warn" />
          {st.invalidationNotice}
        </div>
      )}

      {!info ? (
        <>
          <SectionTitle>1 · Select a method</SectionTitle>
          <p className="text-xs text-muted-foreground">
            NETTOPO has identified the nodes, branches and orientations. No method-specific mathematics (A, Bf, Qf, trees, equations) is computed until you choose a method.
          </p>
          <MethodCards selected={null} onSelect={(m) => st.selectMethod(m, net)} />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1 rounded-lg border bg-card p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold" data-testid="active-method">
                {info.title}
              </span>
              <Button size="xs" variant="ghost" onClick={() => st.selectMethod(null, net)} aria-label="Change method">
                <ArrowLeftRight /> Change
              </Button>
            </div>
            <Tex latex={info.coreEquation} interactive={false} className="text-xs" />
            <p className="text-[11px] text-muted-foreground">{METHOD_WHY[info.id]}</p>
          </div>

          {info.requiresReference && <ReferencePicker net={net} />}

          {info.requiresTree &&
            (st.treeConfirmed ? (
              <div className="flex items-center gap-2 rounded-lg border border-twig/40 bg-twig/5 p-2 text-xs">
                <GitBranch className="size-3.5 text-twig" />
                <span className="min-w-0 flex-1">
                  Tree confirmed: {net.branches.filter((b) => st.treeBranchIds.includes(b.id)).map((b) => b.label).join(', ')}
                </span>
                <Button size="xs" variant="outline" onClick={() => {
                  st.editTree()
                  useUiStore.getState().setMode('tree')
                }}>
                  <Pencil /> Edit tree
                </Button>
              </div>
            ) : (
              <TreeSelectionPanel net={net} onConfirm={() => runCurrentAnalysis(net)} />
            ))}

          {(!info.requiresTree || st.treeConfirmed) && (
            <Button onClick={() => runCurrentAnalysis(net)} disabled={!canRun} data-testid="run-analysis">
              <Play /> {outcome ? 'Re-run analysis' : 'Run analysis'}
            </Button>
          )}
          {phase === 'need-reference' && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="size-3.5" /> Select a reference node before running {info.title.toLowerCase()}.
            </p>
          )}

          {outcome && !outcome.ok && (
            <div className="flex flex-col gap-1.5 rounded-md border border-fail/40 bg-fail/5 p-2 text-xs" role="alert" data-testid="analysis-errors">
              <span className="font-semibold text-fail">Analysis could not be completed</span>
              {outcome.errors.map((e, k) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <span>{e.message}</span>
                  {e.hint && <span className="text-muted-foreground">{e.hint}</span>}
                  {e.branchIds && e.branchIds.length > 0 && (
                    <button
                      type="button"
                      className="self-start text-accent-hl hover:underline"
                      onClick={() => {
                        useUiStore.getState().select(e.branchIds!)
                      }}
                    >
                      Select the branches involved
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {result && (
            <>
              <SectionTitle right={<StatusBadge status={result.verification.overall} />}>Step-by-step analysis</SectionTitle>
              <StepsView steps={result.steps} net={result.networkSnapshot} matrices={result.matrices} result={result} />
            </>
          )}
          {outcome && !outcome.ok && outcome.steps.length > 0 && (
            <>
              <SectionTitle>Steps completed before the failure</SectionTitle>
              <StepsView steps={outcome.steps} net={net} matrices={outcome.matrices} result={null} />
            </>
          )}
        </>
      )}
    </div>
  )
}
