import { Table2 } from 'lucide-react'
import type { AnalysisResult } from '@/domain/analysis/types'
import { METHODS } from '@/domain/analysis/methods'
import { EmptyState, SectionTitle } from '@/components/common'
import { Tex } from '@/components/equations/Tex'
import { formatResidual, formatSI } from '@/engine/numerical'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

export function ResultsPanel({ result }: { result: AnalysisResult | null }) {
  const token = useUiStore((s) => s.highlight?.token ?? null)
  const toggle = useUiStore((s) => s.toggleHighlight)
  const precision = useUiStore((s) => s.precision)
  if (!result) {
    return (
      <EmptyState title="No results yet" icon={<Table2 className="size-6" />}>
        Choose a method, complete its configuration (reference node or spanning tree) and run the analysis.
      </EmptyState>
    )
  }
  const net = result.networkSnapshot
  const refLabel = net.nodes.find((n) => n.id === result.potentialReferenceNodeId)?.label
  const absorbed = result.branches.filter((q) => q.power > 0).reduce((s, q) => s + q.power, 0)
  const delivered = -result.branches.filter((q) => q.power < 0).reduce((s, q) => s + q.power, 0)
  return (
    <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-1.5">
          <SectionTitle>
            Primary unknowns — {METHODS[result.method].title}
          </SectionTitle>
          <table className="w-full text-xs">
            <tbody>
              {result.primary.map((p) => (
                <tr key={p.v.text} className="border-b border-border/60">
                  <td className="py-1">
                    <Tex latex={p.v.latex} interactive={false} />
                  </td>
                  <td className="py-1 text-right font-mono">{formatSI(p.value, p.v.unit, precision)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="flex flex-col gap-1.5">
          <SectionTitle>Node voltages {result.nodeVoltagesDerived ? '(derived)' : ''} w.r.t. {refLabel}</SectionTitle>
          <table className="w-full text-xs">
            <tbody>
              {net.nodes.map((n, j) => {
                const t = `n${j + 1}`
                return (
                  <tr key={n.id} className={cn('border-b border-border/60', token === t && 'bg-accent-hl/15')}>
                    <td className="py-1">
                      <button type="button" className="hover:underline" onClick={() => toggle({ token: t, source: 'list' })}>
                        {n.label}
                        {n.id === result.potentialReferenceNodeId && <span className="ml-1 text-[10px] text-refnode">(reference)</span>}
                      </button>
                    </td>
                    <td className="py-1 text-right font-mono text-volt">{formatSI(result.nodeVoltages[n.id] - result.nodeVoltages[result.potentialReferenceNodeId], 'V', precision)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {result.nodeVoltagesDerived && (
            <p className="text-[10.5px] text-muted-foreground">Tree-based methods do not use node voltages; these come from the branch voltages along the tree from {refLabel}.</p>
          )}
        </section>
        <section className="flex flex-col gap-1 text-xs">
          <SectionTitle>Solver</SectionTitle>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px]">
            <span className="text-muted-foreground">System size</span>
            <span>
              {result.solver.size} × {result.solver.size}
            </span>
            <span className="text-muted-foreground">Rank</span>
            <span>{result.solver.rank}</span>
            <span className="text-muted-foreground">Residual ‖Mx − r‖∞</span>
            <span>{formatResidual(result.solver.residual)}</span>
            <span className="text-muted-foreground">Condition κ₁</span>
            <span>{result.solver.conditionEstimate === null ? '—' : result.solver.conditionEstimate.toPrecision(3)}</span>
          </div>
          {result.warnings.map((w) => (
            <p key={w} className="text-[11px] text-warn">
              ⚠ {w}
            </p>
          ))}
        </section>
      </div>
      <section className="flex min-w-0 flex-col gap-1.5">
        <SectionTitle>Branch currents, voltages and power (passive sign convention)</SectionTitle>
        <div className="overflow-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="text-left text-[10.5px] text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 font-medium">Branch</th>
                <th className="py-1 font-medium">Element</th>
                <th className="py-1 font-medium">From → To</th>
                <th className="py-1 text-right font-medium">iₖ</th>
                <th className="py-1 text-right font-medium">vₖ</th>
                <th className="py-1 text-right font-medium">pₖ = vₖiₖ</th>
                <th className="py-1 pl-2 font-medium">Power</th>
              </tr>
            </thead>
            <tbody>
              {result.branches.map((q) => {
                const b = net.branches.find((x) => x.id === q.branchId)!
                const t = `b${b.index}`
                const from = net.nodes.find((n) => n.id === b.fromNode)?.label
                const to = net.nodes.find((n) => n.id === b.toNode)?.label
                return (
                  <tr key={q.branchId} className={cn('border-b border-border/60', token === t && 'bg-accent-hl/15')}>
                    <td className="py-1">
                      <button type="button" className="font-mono hover:underline" onClick={() => toggle({ token: t, source: 'list' })}>
                        {b.label}
                      </button>
                    </td>
                    <td className="py-1">{b.elementLabel}</td>
                    <td className="py-1 font-mono text-muted-foreground">
                      {from} → {to}
                    </td>
                    <td className="py-1 text-right font-mono text-amp">
                      {formatSI(q.current, 'A', precision)}
                      {q.current < 0 && <span className="ml-1 text-[9.5px] text-muted-foreground">(rev.)</span>}
                    </td>
                    <td className="py-1 text-right font-mono text-volt">{formatSI(q.voltage, 'V', precision)}</td>
                    <td className="py-1 text-right font-mono text-watt">{formatSI(q.power, 'W', precision)}</td>
                    <td className={cn('py-1 pl-2', q.power > 0 ? 'text-muted-foreground' : q.power < 0 ? 'font-medium' : 'text-muted-foreground')}>
                      {q.power > 0 ? 'absorbed' : q.power < 0 ? 'delivered' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          Total absorbed {formatSI(absorbed, 'W', precision)} · total delivered {formatSI(delivered, 'W', precision)} · balance {formatResidual(Math.abs(absorbed - delivered))} W
        </p>
      </section>
    </div>
  )
}
