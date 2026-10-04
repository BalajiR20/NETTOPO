import { AlertTriangle, XCircle } from 'lucide-react'
import { KeyValue, SectionTitle, YesNo } from '@/components/common'
import { componentCount } from '@/engine/graph'
import { useNetwork } from '@/hooks/useNetwork'
import { useAnalysisStore } from '@/store/analysisStore'
import { useUiStore } from '@/store/uiStore'

/**
 * General network information only (lazy-analysis rule): nodes, branches,
 * connectivity. No method-specific mathematics.
 */
export function NetworkStatus() {
  const net = useNetwork()
  const ref = useAnalysisStore((s) => s.referenceNodeId)
  const parts = net.nodes.length ? componentCount(net) : 0
  const n = net.nodes.length
  const b = net.branches.length
  const counts = { resistor: 0, voltageSource: 0, currentSource: 0 }
  for (const br of net.branches) counts[br.element.type]++
  return (
    <div className="flex flex-col gap-1.5" data-testid="network-status">
      <SectionTitle>Network</SectionTitle>
      <KeyValue k="Nodes (n)" v={n} />
      <KeyValue k="Branches (b)" v={b} />
      <KeyValue k="Connected" v={<YesNo ok={parts === 1 && b > 0} />} />
      <KeyValue k="Separate parts" v={parts} />
      <KeyValue k="Twigs / links per tree" v={b > 0 && parts === 1 ? `${n - 1} / ${b - n + 1}` : '—'} />
      <KeyValue k="Elements" v={`${counts.resistor} R · ${counts.voltageSource} V · ${counts.currentSource} I`} />
      <KeyValue k="Reference node" v={ref ? (net.nodes.find((x) => x.id === ref)?.label ?? '—') : 'not selected'} />
      {net.issues.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1" aria-label="Network issues">
          {net.issues.map((i, k) => (
            <li key={k}>
              <button
                type="button"
                className="flex w-full gap-1.5 rounded border p-1.5 text-left text-[11px] hover:bg-muted"
                onClick={() => i.componentIds?.length && useUiStore.getState().select(i.componentIds)}
              >
                {i.severity === 'error' ? <XCircle className="mt-px size-3.5 shrink-0 text-fail" /> : <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn" />}
                <span>
                  {i.message}
                  {i.hint && <span className="block text-muted-foreground">{i.hint}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
