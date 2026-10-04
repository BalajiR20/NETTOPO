import { useEffect, useState } from 'react'
import { FolderOpen, Trash2, Upload } from 'lucide-react'
import { METHOD_ORDER, METHODS } from '@/domain/analysis/methods'
import type { MethodId } from '@/domain/analysis/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Kbd } from '@/components/ui/kbd'
import { MethodCards } from '@/components/analysis/MethodCards'
import { StatusBadge } from '@/components/common'
import { importProjectFile, openStoredProject, removeStoredProject } from '@/app/projectActions'
import { compareMethods, type Comparison } from '@/engine/solvers'
import { formatResidual, formatSI } from '@/engine/numerical'
import { useNetwork } from '@/hooks/useNetwork'
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts'
import { listProjects, type StoredProject } from '@/persistence/db'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import { useProjectStore } from '@/store/projectStore'
import { useUiStore } from '@/store/uiStore'

function useDialog(name: keyof ReturnType<typeof useUiStore.getState>['dialogs']) {
  const open = useUiStore((s) => s.dialogs[name])
  return { open, onOpenChange: (v: boolean) => useUiStore.getState().setDialog(name, v) }
}

export function OpenProjectDialog() {
  const d = useDialog('open')
  const current = useProjectStore((s) => s.projectId)
  const [projects, setProjects] = useState<StoredProject[] | null>(null)
  useEffect(() => {
    if (d.open) void listProjects().then(setProjects)
  }, [d.open])
  return (
    <Dialog {...d}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open project</DialogTitle>
          <DialogDescription>Projects saved in this browser (IndexedDB). Use Import to open a .nettopo file.</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-80 flex-col divide-y overflow-auto rounded-md border" aria-label="Saved projects">
          {projects === null && <li className="p-3 text-xs text-muted-foreground">Loading…</li>}
          {projects?.length === 0 && <li className="p-3 text-xs text-muted-foreground">No saved projects yet. Press Save to store the current one.</li>}
          {projects?.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {p.name} {p.id === current && <span className="text-[10px] text-muted-foreground">(current)</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(p.updatedAt).toLocaleString()} · {p.file.network.components.length} components
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await openStoredProject(p.id)
                  d.onOpenChange(false)
                }}
              >
                <FolderOpen /> Open
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${p.name}`}
                disabled={p.id === current}
                onClick={async () => {
                  await removeStoredProject(p.id)
                  setProjects(await listProjects())
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.nettopo,.json,application/json'
              input.onchange = async () => {
                if (input.files?.[0] && (await importProjectFile(input.files[0]))) d.onOpenChange(false)
              }
              input.click()
            }}
          >
            <Upload /> Import .nettopo / JSON…
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SettingsDialog() {
  const d = useDialog('settings')
  const s = useUiStore()
  const row = (id: string, label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string) => (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
  return (
    <Dialog {...d}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Stored locally in this browser.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {row('set-dark', 'Dark theme', s.theme === 'dark', (v) => s.setSettings({ theme: v ? 'dark' : 'light' }))}
          {row('set-hc', 'High contrast', s.highContrast, (v) => s.setSettings({ highContrast: v }), 'Stronger lines and text for projectors and low vision.')}
          {row('set-snap', 'Snap to grid', s.snapToGrid, (v) => s.setSettings({ snapToGrid: v }))}
          {row('set-grid', 'Show grid', s.showGrid, (v) => s.setSettings({ showGrid: v }))}
          {row('set-orient', 'Show branch orientation arrows', s.display.orientation, (v) => s.setDisplay({ orientation: v }))}
          {row('set-values', 'Show component labels and values', s.display.values, (v) => s.setDisplay({ values: v }))}
          <div className="flex items-center gap-3">
            <Label htmlFor="set-prec" className="w-44">
              Displayed significant digits
            </Label>
            <select id="set-prec" className="h-8 rounded-md border bg-background px-2 text-sm" value={s.precision} onChange={(e) => s.setSettings({ precision: Number(e.target.value) })}>
              {[3, 4, 5, 6].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ShortcutsDialog() {
  const d = useDialog('shortcuts')
  return (
    <Dialog {...d}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts are inactive while typing in a field.</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.action} className="border-b last:border-0">
                <td className="py-1.5 pr-3">
                  <span className="flex flex-wrap gap-1">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </td>
                <td className="py-1.5 text-muted-foreground">{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}

export function MethodDialog() {
  const d = useDialog('methods')
  const method = useAnalysisStore((s) => s.method)
  const net = useNetwork()
  return (
    <Dialog {...d}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select an analysis method</DialogTitle>
          <DialogDescription>Only the mathematics required by the chosen method will be generated. Nothing is calculated until you choose.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-auto">
          <MethodCards
            selected={method}
            columns={2}
            onSelect={(m) => {
              useAnalysisStore.getState().selectMethod(m, net)
              useUiStore.getState().setRightTab('analysis')
              d.onOpenChange(false)
              if (METHODS[m].requiresTree) useUiStore.getState().setMode('tree')
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CompareDialog() {
  const d = useDialog('compare')
  const net = useNetwork()
  const ref = useAnalysisStore((s) => s.referenceNodeId)
  const tree = useAnalysisStore((s) => s.treeBranchIds)
  const [selected, setSelected] = useState<MethodId[]>(['nodal', 'loop', 'nodePair'])
  const [cmp, setCmp] = useState<Comparison | null>(null)
  return (
    <Dialog
      open={d.open}
      onOpenChange={(v) => {
        if (!v) setCmp(null)
        d.onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Compare methods</DialogTitle>
          <DialogDescription>Runs the selected methods on the current circuit, and only when you press Compare. All methods should give the same physical solution.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          {METHOD_ORDER.map((m) => (
            <label key={m} className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs', selected.includes(m) && 'border-accent-hl bg-accent-hl/10')}>
              <input type="checkbox" checked={selected.includes(m)} onChange={(e) => setSelected(e.target.checked ? [...selected, m] : selected.filter((x) => x !== m))} />
              {METHODS[m].title}
            </label>
          ))}
          <Button size="sm" className="ml-auto" disabled={selected.length < 2} onClick={() => setCmp(compareMethods(net, METHOD_ORDER.filter((m) => selected.includes(m)), { referenceNodeId: ref, treeBranchIds: tree.length ? tree : null }))} data-testid="run-compare">
            Compare
          </Button>
        </div>
        {cmp && (
          <div className="flex max-h-[55vh] flex-col gap-2 overflow-auto">
            <div className="flex flex-wrap gap-3 text-xs">
              <span>
                Max spread between methods: <b className="font-mono">{formatResidual(cmp.maxSpread)}</b>
              </span>
              {cmp.usedSuggestedTree && <span className="text-muted-foreground">No tree was selected, so a suggested tree was used.</span>}
              {cmp.usedDefaultReference && <span className="text-muted-foreground">No reference node was selected, so the ground (or last) node was used.</span>}
            </div>
            {cmp.methods.map((m) => {
              const o = cmp.outcomes[m]
              return o && !o.ok ? (
                <p key={m} className="text-xs text-fail">
                  {METHODS[m].title}: {o.errors[0]?.message}
                </p>
              ) : null
            })}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 font-medium">Quantity</th>
                  {cmp.methods.map((m) => (
                    <th key={m} className="py-1 text-right font-medium">
                      {METHODS[m].short}
                    </th>
                  ))}
                  <th className="py-1 text-right font-medium">Spread</th>
                  <th className="py-1 pl-2 font-medium" />
                </tr>
              </thead>
              <tbody className="font-mono">
                {cmp.rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/50">
                    <td className="py-0.5 font-sans">{r.label}</td>
                    {cmp.methods.map((m) => (
                      <td key={m} className="py-0.5 text-right">
                        {r.values[m] === undefined ? '—' : formatSI(r.values[m]!, r.unit, 5)}
                      </td>
                    ))}
                    <td className="py-0.5 text-right">{formatResidual(r.spread)}</td>
                    <td className="py-0.5 pl-2">
                      <StatusBadge status={r.spread <= 1e-9 * Math.max(1, ...Object.values(r.values).map((x) => Math.abs(x!))) ? 'pass' : 'fail'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
