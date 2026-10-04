import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EquationsPanel } from '@/components/equations/EquationsPanel'
import { MatrixPanel } from '@/components/matrices/MatrixPanel'
import { Oscilloscope } from '@/components/oscilloscope/Oscilloscope'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { TopologyExplorer } from '@/components/topology/TopologyExplorer'
import { VerificationPanel } from '@/components/verification/VerificationPanel'
import { StatusBadge } from '@/components/common'
import { useResult } from '@/hooks/useResult'
import { useUiStore, type BottomTab } from '@/store/uiStore'

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'explorer', label: 'Topology Explorer' },
  { id: 'equations', label: 'Equations' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'results', label: 'Results' },
  { id: 'verification', label: 'Verification' },
  { id: 'oscilloscope', label: 'Oscilloscope' },
]

export function BottomPanel({ onToggle }: { onToggle?: (open: boolean) => void }) {
  const tab = useUiStore((s) => s.bottomTab)
  const open = useUiStore((s) => s.bottomOpen)
  const result = useResult()
  return (
    <Tabs value={tab} onValueChange={(v) => useUiStore.getState().setBottomTab(v as BottomTab)} className="flex h-full min-h-0 flex-col gap-0 bg-card">
      <div className="flex shrink-0 items-center gap-1 border-b px-1.5">
        <TabsList variant="line" className="h-9 overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs" data-testid={`tab-${t.id}`}>
              {t.label}
              {t.id === 'verification' && result && <StatusBadge status={result.verification.overall} className="ml-1 scale-90" />}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          aria-label={open ? 'Collapse bottom panel' : 'Expand bottom panel'}
          onClick={() => {
            useUiStore.getState().setPanel('bottomOpen', !open)
            onToggle?.(!open)
          }}
        >
          {open ? <ChevronDown /> : <ChevronUp />}
        </Button>
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-auto">
          <TabsContent value="explorer" className="h-full">
            <TopologyExplorer result={result} />
          </TabsContent>
          <TabsContent value="equations">
            <EquationsPanel result={result} />
          </TabsContent>
          <TabsContent value="matrix">
            <MatrixPanel result={result} />
          </TabsContent>
          <TabsContent value="results">
            <ResultsPanel result={result} />
          </TabsContent>
          <TabsContent value="verification">
            <VerificationPanel result={result} />
          </TabsContent>
          <TabsContent value="oscilloscope" className="h-full">
            <Oscilloscope result={result} />
          </TabsContent>
        </div>
      )}
    </Tabs>
  )
}
