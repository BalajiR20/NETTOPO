import type { ReactNode } from 'react'
import { Cable } from 'lucide-react'
import { GROUND_PATH, SYMBOL_PATHS } from '@/lib/symbols'
import { cn } from '@/lib/utils'
import { addItem } from './addItem'
import { canvasApi, DRAG_MIME } from './canvasApi'

const Sym = ({ kind }: { kind: keyof typeof SYMBOL_PATHS }) => {
  const s = SYMBOL_PATHS[kind]
  return (
    <svg viewBox="-44 -20 88 40" className="h-6 w-12" aria-hidden>
      {s.circle && <circle r={s.circle.r} fill="none" stroke="currentColor" strokeWidth={2.2} />}
      <path d={s.stroke} stroke="currentColor" strokeWidth={2.2} fill="none" strokeLinejoin="round" />
      {s.fill && <path d={s.fill} fill="currentColor" />}
    </svg>
  )
}

const ITEMS: { kind: string; label: string; hint: string; icon: ReactNode }[] = [
  { kind: 'node', label: 'Node', hint: 'Named node marker', icon: <span className="block size-3.5 rounded-full border-[2.5px] border-current" /> },
  { kind: 'junction', label: 'Junction', hint: 'Wire junction dot', icon: <span className="block size-2 rounded-full bg-current" /> },
  { kind: 'resistor', label: 'Resistor', hint: 'R (Ω)', icon: <Sym kind="resistor" /> },
  { kind: 'voltageSource', label: 'Voltage Source', hint: 'Independent E (V), + at pin a', icon: <Sym kind="voltageSource" /> },
  { kind: 'currentSource', label: 'Current Source', hint: 'Independent I (A), arrow a → b', icon: <Sym kind="currentSource" /> },
  {
    kind: 'ground',
    label: 'Ground',
    hint: 'Reference symbol (all grounds = one node)',
    icon: (
      <svg viewBox="-16 -22 32 36" className="h-6 w-6" aria-hidden>
        <path d={GROUND_PATH} stroke="currentColor" strokeWidth={2.2} fill="none" />
      </svg>
    ),
  },
]

export function Toolbox({ wireTool, onWireTool, compact = false }: { wireTool: boolean; onWireTool: (v: boolean) => void; compact?: boolean }) {
  return (
    <div className={cn('grid gap-1', compact ? 'grid-cols-1' : 'grid-cols-2')} role="toolbar" aria-label="Components">
      {ITEMS.map((it) => (
        <button
          key={it.kind}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, it.kind)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => {
            const c = canvasApi.center()
            addItem(it.kind, { x: c.x + (Math.random() - 0.5) * 80, y: c.y + (Math.random() - 0.5) * 80 })
          }}
          title={`${it.label} — ${it.hint}. Drag onto the canvas or click to add at the centre.`}
          aria-label={`Add ${it.label}`}
          data-testid={`tool-${it.kind}`}
          className="flex cursor-grab flex-col items-center gap-0.5 rounded-md border bg-card px-1 py-1.5 text-symbol hover:border-accent-hl/60 hover:bg-accent-hl/5 active:cursor-grabbing"
        >
          <span className="grid h-6 place-items-center">{it.icon}</span>
          <span className="text-[10.5px] leading-tight text-foreground">{it.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onWireTool(!wireTool)}
        aria-pressed={wireTool}
        title="Wire tool: shows every terminal. Drag from one terminal to another, or click one terminal then the other. Dropping on empty canvas creates a junction."
        data-testid="tool-wire"
        className={cn(
          'col-span-full flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs',
          wireTool ? 'border-accent-hl bg-accent-hl/15 text-foreground' : 'bg-card hover:bg-muted',
        )}
      >
        <Cable className="size-4" /> Wire {wireTool ? '(on)' : ''}
      </button>
    </div>
  )
}
