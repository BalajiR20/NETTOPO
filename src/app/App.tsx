import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel'
import { CanvasArea } from '@/components/circuit/CanvasArea'
import { NetworkStatus } from '@/components/circuit/NetworkStatus'
import { PropertiesPanel } from '@/components/circuit/PropertiesPanel'
import { Toolbox } from '@/components/circuit/Toolbox'
import { TexHighlightStyle } from '@/components/equations/Tex'
import { BottomPanel } from '@/components/layout/BottomPanel'
import { CompareDialog, MethodDialog, OpenProjectDialog, SettingsDialog, ShortcutsDialog } from '@/components/layout/Dialogs'
import { TopBar } from '@/components/layout/TopBar'
import { useAnalysisSync, usePersistence, useThemeClass } from '@/hooks/useAppEffects'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { cn } from '@/lib/utils'
import { useUiStore, type RightTab } from '@/store/uiStore'
import { useAnalysisStore } from '@/store/analysisStore'

function useMediaQuery(q: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : true))
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

function LeftSidebar({ wireTool, setWireTool }: { wireTool: boolean; setWireTool: (v: boolean) => void }) {
  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto bg-card p-3" aria-label="Components and network status">
      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Components</h2>
        <Toolbox wireTool={wireTool} onWireTool={setWireTool} />
        <p className="text-[10.5px] leading-snug text-muted-foreground">
          Drag onto the canvas. Connect terminals by dragging between the small dots. Press R to rotate and O to reverse a branch.
        </p>
      </section>
      <NetworkStatus />
    </aside>
  )
}

function RightSidebar() {
  const tab = useUiStore((s) => s.rightTab)
  return (
    <aside className="flex h-full min-h-0 flex-col bg-card" aria-label="Properties and analysis">
      <Tabs value={tab} onValueChange={(v) => useUiStore.getState().setRightTab(v as RightTab)} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList variant="line" className="h-9 w-full shrink-0 justify-start border-b px-1.5">
          <TabsTrigger value="properties" className="text-xs" data-testid="tab-properties">
            Properties
          </TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs" data-testid="tab-analysis">
            Analysis
          </TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="properties">
            <PropertiesPanel />
          </TabsContent>
          <TabsContent value="analysis">
            <AnalysisPanel />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  )
}

export function App() {
  useThemeClass()
  useAnalysisSync()
  usePersistence()
  const [wireTool, setWireTool] = useState(false)
  const toggleWire = useCallback(() => setWireTool((w) => !w), [])
  useKeyboardShortcuts(toggleWire)
  const desktop = useMediaQuery('(min-width: 1024px)')
  const leftOpen = useUiStore((s) => s.leftOpen)
  const rightOpen = useUiStore((s) => s.rightOpen)
  const bottomOpen = useUiStore((s) => s.bottomOpen)
  const selection = useUiStore((s) => s.selection)

  // Selecting something on the canvas brings up its properties.
  useEffect(() => {
    // Don't pull the user away from the analysis steps while a method is active.
    if (selection.length === 1 && useUiStore.getState().rightTab !== 'properties' && useUiStore.getState().mode === 'edit' && !useAnalysisStore.getState().method) {
      const t = setTimeout(() => useUiStore.getState().setRightTab('properties'), 0)
      return () => clearTimeout(t)
    }
  }, [selection])

  // Small screens start with collapsed sidebars.
  useEffect(() => {
    if (!desktop) {
      useUiStore.getState().setPanel('leftOpen', false)
      useUiStore.getState().setPanel('rightOpen', false)
    } else {
      useUiStore.getState().setPanel('leftOpen', true)
      useUiStore.getState().setPanel('rightOpen', true)
    }
  }, [desktop])

  const center = (
    <ResizablePanelGroup orientation="vertical" id="nt-center">
      <ResizablePanel id="canvas" defaultSize="62%" minSize="25%">
        <main className="h-full" aria-label="Circuit editor">
          <CanvasArea wireTool={wireTool} />
        </main>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="bottom" defaultSize="38%" minSize={bottomOpen ? '15%' : 38} maxSize={bottomOpen ? '80%' : 38}>
        <BottomPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  )

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-full flex-col bg-background text-foreground">
        <a href="#nt-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-2">
          Skip to canvas
        </a>
        <TopBar />
        <div id="nt-main" className="relative min-h-0 flex-1">
          {desktop ? (
            <ResizablePanelGroup orientation="horizontal" id="nt-root">
              {leftOpen && (
                <>
                  <ResizablePanel id="left" defaultSize={232} minSize={180} maxSize={360}>
                    <LeftSidebar wireTool={wireTool} setWireTool={setWireTool} />
                  </ResizablePanel>
                  <ResizableHandle />
                </>
              )}
              <ResizablePanel id="center" minSize="30%">
                {center}
              </ResizablePanel>
              {rightOpen && (
                <>
                  <ResizableHandle />
                  <ResizablePanel id="right" defaultSize={380} minSize={300} maxSize={640}>
                    <RightSidebar />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          ) : (
            <>
              {center}
              {(leftOpen || rightOpen) && <div className="absolute inset-0 z-30 bg-black/30" onClick={() => {
                useUiStore.getState().setPanel('leftOpen', false)
                useUiStore.getState().setPanel('rightOpen', false)
              }} aria-hidden />}
              <div className={cn('absolute inset-y-0 left-0 z-40 w-64 border-r shadow-xl transition-transform', leftOpen ? 'translate-x-0' : '-translate-x-full')} aria-hidden={!leftOpen}>
                <Button size="icon-xs" variant="ghost" className="absolute right-1 top-1 z-10" onClick={() => useUiStore.getState().setPanel('leftOpen', false)} aria-label="Close components panel">
                  <X />
                </Button>
                <LeftSidebar wireTool={wireTool} setWireTool={setWireTool} />
              </div>
              <div className={cn('absolute inset-y-0 right-0 z-40 w-[min(26rem,92vw)] border-l shadow-xl transition-transform', rightOpen ? 'translate-x-0' : 'translate-x-full')} aria-hidden={!rightOpen}>
                <RightSidebar />
              </div>
            </>
          )}
        </div>
        <OpenProjectDialog />
        <SettingsDialog />
        <ShortcutsDialog />
        <MethodDialog />
        <CompareDialog />
        <TexHighlightStyle />
        <Toaster position="bottom-right" richColors closeButton />
      </div>
    </TooltipProvider>
  )
}
