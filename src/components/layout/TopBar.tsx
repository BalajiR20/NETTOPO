import { useState, type ReactNode } from 'react'
import {
  BookOpen,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  FileDown,
  FileJson,
  FilePlus2,
  FolderOpen,
  GitCompareArrows,
  Keyboard,
  Loader2,
  PanelLeft,
  PanelRight,
  Play,
  Redo2,
  Save,
  Settings,
  Undo2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { exportProjectJson, importProjectFile, loadExample, newProject, saveCurrentProject } from '@/app/projectActions'
import { EXAMPLES } from '@/examples'
import { useNetwork } from '@/hooks/useNetwork'
import { useResult } from '@/hooks/useResult'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import { useCircuitStore } from '@/store/circuitStore'
import { useProjectStore } from '@/store/projectStore'
import { useReportStore } from '@/store/reportStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useUiStore } from '@/store/uiStore'

function IconButton({ label, shortcut, onClick, disabled, children, testId, showLabel = false }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean; children: ReactNode; testId?: string; showLabel?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size={showLabel ? 'sm' : 'icon-sm'} onClick={onClick} disabled={disabled} aria-label={label} data-testid={testId}>
          {children}
          {showLabel && <span className="hidden xl:inline">{label}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 font-mono opacity-70">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

function SaveIndicator() {
  const status = useProjectStore((s) => s.saveStatus)
  const err = useProjectStore((s) => s.saveError)
  const map = {
    saved: { icon: <Check className="size-3.5" />, text: 'Saved', cls: 'text-muted-foreground' },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…', cls: 'text-muted-foreground' },
    unsaved: { icon: <Cloud className="size-3.5" />, text: 'Unsaved changes', cls: 'text-warn' },
    error: { icon: <CloudOff className="size-3.5" />, text: 'Save failed', cls: 'text-fail' },
  }[status]
  return (
    <span className={cn('hidden items-center gap-1 text-[11px] md:inline-flex', map.cls)} role="status" aria-live="polite" title={err ?? 'Projects are saved locally in this browser (IndexedDB).'} data-testid="save-status">
      {map.icon}
      {map.text}
    </span>
  )
}

export function TopBar() {
  const name = useProjectStore((s) => s.name)
  const canUndo = useCircuitStore((s) => s.past.length > 0)
  const canRedo = useCircuitStore((s) => s.future.length > 0)
  const result = useResult()
  const reportStatus = useReportStore((s) => s.status)
  const leftOpen = useUiStore((s) => s.leftOpen)
  const rightOpen = useUiStore((s) => s.rightOpen)
  const net = useNetwork()
  const [editingName, setEditingName] = useState(false)

  const exportPdf = async () => {
    if (!result) {
      toast.error('Run an analysis before exporting a report.', { description: 'The report documents a real solution: choose a method, configure it and run it first.' })
      return
    }
    useReportStore.getState().setStatus('generating')
    const id = toast.loading('Generating PDF report…')
    try {
      const { exportPdfReport } = await import('@/engine/reporting/exportReport')
      const p = useProjectStore.getState()
      const sim = useSimulationStore.getState()
      const out = await exportPdfReport({
        schematic: useCircuitStore.getState().schematic,
        net: result.networkSnapshot,
        result,
        projectName: p.name,
        problem: p.description,
        treeBranchIds: useAnalysisStore.getState().treeBranchIds,
        referenceNodeId: useAnalysisStore.getState().referenceNodeId,
        channels: sim.channels,
        timePerDiv: sim.timePerDiv,
      })
      useReportStore.getState().setStatus('done', out.filename)
      toast.success(`Report saved: ${out.filename}`, { id, description: `${out.pages} pages, generated locally.` })
    } catch (e) {
      useReportStore.getState().setStatus('error', (e as Error).message)
      toast.error(`PDF export failed: ${(e as Error).message}`, { id })
    }
  }

  const pickImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.nettopo,.json,application/json'
    input.onchange = () => input.files?.[0] && void importProjectFile(input.files[0])
    input.click()
  }

  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b bg-card px-2" role="banner">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={leftOpen ? 'Hide components' : 'Show components'} onClick={() => useUiStore.getState().setPanel('leftOpen', !leftOpen)}>
        <PanelLeft />
      </Button>
      <div className="flex items-center gap-2 pr-2">
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
          <rect width="32" height="32" rx="6" className="fill-foreground" />
          <path d="M8 9 L24 9 L16 23 Z" stroke="var(--nt-highlight)" strokeWidth="2.2" fill="none" />
          <g className="fill-background">
            <circle cx="8" cy="9" r="3" />
            <circle cx="24" cy="9" r="3" />
            <circle cx="16" cy="23" r="3" />
          </g>
        </svg>
        <span className="text-sm font-bold tracking-wide">NETTOPO</span>
      </div>
      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        {editingName ? (
          <input
            autoFocus
            defaultValue={name}
            className="h-7 w-48 rounded border bg-background px-2 text-xs"
            aria-label="Project name"
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) useProjectStore.getState().setMeta({ name: v })
              setEditingName(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditingName(false)
            }}
          />
        ) : (
          <button type="button" className="max-w-56 truncate rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setEditingName(true)} title="Rename project">
            {name}
          </button>
        )}
        <SaveIndicator />
      </div>

      <nav className="ml-2 flex items-center gap-0.5" aria-label="Project">
        <IconButton label="New" onClick={newProject} testId="btn-new" showLabel>
          <FilePlus2 />
        </IconButton>
        <IconButton label="Open" onClick={() => useUiStore.getState().setDialog('open', true)} testId="btn-open" showLabel>
          <FolderOpen />
        </IconButton>
        <IconButton label="Save" shortcut="Ctrl+S" onClick={() => void saveCurrentProject()} testId="btn-save" showLabel>
          <Save />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="File and examples">
              <FileJson /> <span className="hidden lg:inline">File</span> <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Project file (.nettopo JSON)</DropdownMenuLabel>
            <DropdownMenuItem onSelect={pickImport}>
              <Upload /> Import JSON…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={exportProjectJson}>
              <FileJson /> Export JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Examples (with expected results)</DropdownMenuLabel>
            {EXAMPLES.map((ex) => (
              <DropdownMenuItem key={ex.id} onSelect={() => loadExample(ex)} data-testid={`example-${ex.id}`}>
                <BookOpen />
                <span className="flex flex-col">
                  <span>{ex.title}</span>
                  <span className="text-[10.5px] text-muted-foreground">{ex.summary}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="mx-1 h-5 w-px bg-border" />
      <IconButton label="Undo" shortcut="Ctrl+Z" onClick={() => useCircuitStore.getState().undo()} disabled={!canUndo} testId="btn-undo">
        <Undo2 />
      </IconButton>
      <IconButton label="Redo" shortcut="Ctrl+Shift+Z" onClick={() => useCircuitStore.getState().redo()} disabled={!canRedo} testId="btn-redo">
        <Redo2 />
      </IconButton>
      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        size="sm"
        onClick={() => {
          useUiStore.getState().setDialog('methods', true)
        }}
        data-testid="btn-analyze"
        disabled={net.branches.length === 0}
      >
        <Play /> Analyze
      </Button>
      <IconButton label="Compare methods" onClick={() => useUiStore.getState().setDialog('compare', true)} testId="btn-compare" showLabel>
        <GitCompareArrows />
      </IconButton>
      <IconButton label="Export PDF" onClick={() => void exportPdf()} disabled={reportStatus === 'generating'} testId="btn-export-pdf" showLabel>
        {reportStatus === 'generating' ? <Loader2 className="animate-spin" /> : <FileDown />}
      </IconButton>

      <div className="ml-auto flex items-center gap-0.5">
        <IconButton label="Keyboard shortcuts" shortcut="?" onClick={() => useUiStore.getState().setDialog('shortcuts', true)}>
          <Keyboard />
        </IconButton>
        <IconButton label="Settings" onClick={() => useUiStore.getState().setDialog('settings', true)} testId="btn-settings">
          <Settings />
        </IconButton>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={rightOpen ? 'Hide analysis panel' : 'Show analysis panel'} onClick={() => useUiStore.getState().setPanel('rightOpen', !rightOpen)}>
          <PanelRight />
        </Button>
      </div>
    </header>
  )
}
