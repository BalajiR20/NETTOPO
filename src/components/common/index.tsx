import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from 'lucide-react'
import type { CheckStatus } from '@/domain/analysis/types'
import { cn } from '@/lib/utils'

export function EmptyState({ title, children, icon, className }: { title: string; children?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-full min-h-24 flex-col items-center justify-center gap-1.5 p-6 text-center', className)}>
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="max-w-md text-xs text-muted-foreground">{children}</div>}
    </div>
  )
}

const STATUS = {
  pass: { label: 'PASS', cls: 'bg-pass/15 text-pass border-pass/40', Icon: CheckCircle2 },
  warning: { label: 'WARNING', cls: 'bg-warn/15 text-warn border-warn/40', Icon: AlertTriangle },
  fail: { label: 'FAIL', cls: 'bg-fail/15 text-fail border-fail/40', Icon: XCircle },
  skipped: { label: 'SKIPPED', cls: 'bg-muted text-muted-foreground border-border', Icon: CircleSlash },
} as const

export function StatusBadge({ status, className }: { status: CheckStatus; className?: string }) {
  const s = STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide', s.cls, className)}>
      <s.Icon className="size-3" aria-hidden />
      {s.label}
    </span>
  )
}

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
      {right}
    </div>
  )
}

export function KeyValue({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-xs', className)}>
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  )
}

export function YesNo({ ok, yes = 'YES', no = 'NO', invert = false }: { ok: boolean; yes?: string; no?: string; invert?: boolean }) {
  const good = invert ? !ok : ok
  return <span className={cn('font-mono font-semibold', good ? 'text-pass' : 'text-fail')}>{ok ? yes : no}</span>
}
