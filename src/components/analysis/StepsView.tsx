import { useState } from 'react'
import { ChevronRight, HelpCircle } from 'lucide-react'
import type { AnalysisResult, AnalysisStep, LinearEquation, StepBlock } from '@/domain/analysis/types'
import type { LabeledMatrix } from '@/domain/topology/types'
import type { Network } from '@/domain/network/types'
import { Tex } from '@/components/equations/Tex'
import { EquationGroupView } from '@/components/equations/EquationsPanel'
import { MatrixTable } from '@/components/matrices/MatrixTable'
import { cn } from '@/lib/utils'

interface Ctx {
  net: Network
  matrices: LabeledMatrix[]
  result: AnalysisResult | null
  groups: { id: string; title: string; matrixForm: string; description: string; equations: LinearEquation[] }[]
}

function Block({ block, ctx }: { block: StepBlock; ctx: Ctx }) {
  switch (block.type) {
    case 'text':
      return <p className="text-xs">{block.text}</p>
    case 'latex':
      return <Tex latex={block.latex} display={block.display} />
    case 'list':
      return (
        <ul className="list-disc pl-4 text-xs">
          {block.items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {block.columns.map((c) => (
                  <th key={c} className="py-0.5 pr-3 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {block.rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  {r.map((c, j) => (
                    <td key={j} className="py-0.5 pr-3">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'matrix': {
      const m = ctx.matrices.find((x) => x.id === block.matrixId)
      return m ? <MatrixTable matrix={m} net={ctx.net} result={ctx.result} compact /> : null
    }
    case 'equations': {
      const g = ctx.groups.find((x) => x.id === block.groupId)
      return g ? <EquationGroupView group={g} compact /> : null
    }
  }
}

function Step({ step, ctx, defaultOpen }: { step: AnalysisStep; ctx: Ctx; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [why, setWhy] = useState(false)
  return (
    <li className="rounded-md border bg-card" data-testid={`step-${step.id}`}>
      <button type="button" className="flex w-full items-start gap-2 px-2 py-1.5 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronRight className={cn('mt-0.5 size-3.5 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
        <span className="mt-px shrink-0 font-mono text-[10px] font-semibold text-muted-foreground">STEP {step.number}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold">{step.title}</span>
          <span className="block text-[11px] text-muted-foreground">{step.summary}</span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t px-3 py-2">
          {step.blocks.map((b, i) => (
            <Block key={i} block={b} ctx={ctx} />
          ))}
          {step.why && (
            <div>
              <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-hl hover:underline" onClick={() => setWhy(!why)} aria-expanded={why}>
                <HelpCircle className="size-3.5" /> WHY?
              </button>
              {why && <p className="mt-1 rounded bg-accent-hl/5 p-2 text-xs">{step.why}</p>}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function StepsView({ steps, net, matrices, result }: { steps: AnalysisStep[]; net: Network; matrices: LabeledMatrix[]; result: AnalysisResult | null }) {
  const ctx: Ctx = { net, matrices, result, groups: result?.equationGroups ?? [] }
  return (
    <ol className="flex flex-col gap-1.5" aria-label="Step-by-step analysis">
      {steps.map((s, i) => (
        <Step key={s.id + i} step={s} ctx={ctx} defaultOpen={false} />
      ))}
    </ol>
  )
}
