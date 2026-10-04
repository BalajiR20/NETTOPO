import { useMemo, useState } from 'react'
import type { AnalysisResult } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import type { LabeledMatrix } from '@/domain/topology/types'
import { formatNumber } from '@/engine/numerical'
import { Tex } from '@/components/equations/Tex'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'
import { axisToken, explainEntry } from './explain'

interface Props {
  matrix: LabeledMatrix
  net: Network
  result: AnalysisResult | null
  compact?: boolean
  showHeader?: boolean
}

/**
 * Interactive matrix: click a column → highlight the branch; click a row →
 * highlight node / f-circuit / f-cut-set; click an entry → explanation.
 * Highlights made elsewhere (canvas, equations) are reflected here.
 */
export function MatrixTable({ matrix, net, result, compact = false, showHeader = true }: Props) {
  const token = useUiStore((s) => s.highlight?.token ?? null)
  const toggleHighlight = useUiStore((s) => s.toggleHighlight)
  const hasTreeGroups = matrix.cols.some((c) => c.group === 'twig') && matrix.cols.some((c) => c.group === 'link')
  const [partitioned, setPartitioned] = useState(true)
  const [explained, setExplained] = useState<{ r: number; c: number } | null>(null)

  const colOrder = useMemo(() => {
    const idx = matrix.cols.map((_, j) => j)
    if (!hasTreeGroups || !partitioned) return idx
    return [...idx.filter((j) => matrix.cols[j].group === 'twig'), ...idx.filter((j) => matrix.cols[j].group !== 'twig')]
  }, [matrix, hasTreeGroups, partitioned])

  const colTokens = useMemo(() => matrix.cols.map((c) => axisToken(net, c)), [matrix, net])
  const rowTokens = useMemo(() => matrix.rows.map((r) => axisToken(net, r)), [matrix, net])
  const rhsIndex = matrix.cols.findIndex((c) => c.kind === 'rhs')
  const firstLinkPos = hasTreeGroups && partitioned ? colOrder.findIndex((j) => matrix.cols[j].group !== 'twig') : -1
  const cellPad = compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
  const isTextbookMatrix = matrix.kind === 'fcircuit' || matrix.kind === 'fcutset'

  return (
    <div className="flex flex-col gap-1.5" data-testid={`matrix-${matrix.id}`}>
      {showHeader && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Tex latex={`${matrix.symbol}\\ \\ (${matrix.rows.length}\\times${matrix.cols.length - (rhsIndex >= 0 ? 1 : 0)})`} />
          <span className="text-xs font-medium">{matrix.title}</span>
          {hasTreeGroups && (
            <div className="ml-auto flex items-center gap-1.5">
              <Switch id={`part-${matrix.id}`} checked={partitioned} onCheckedChange={setPartitioned} />
              <Label htmlFor={`part-${matrix.id}`} className="text-xs text-muted-foreground">
                Twigs | links{isTextbookMatrix ? (matrix.kind === 'fcircuit' ? ' — [B_ft | U]' : ' — [U | Q_fl]') : ''}
              </Label>
            </div>
          )}
        </div>
      )}
      {showHeader && !compact && <p className="text-xs text-muted-foreground">{matrix.description}</p>}
      <div className="max-w-full overflow-auto rounded-md border bg-card">
        <table className="border-collapse font-mono text-xs" role="grid" aria-label={`${matrix.title} ${matrix.id}`}>
          <thead>
            <tr>
              <th className={cn('sticky left-0 top-0 z-20 bg-muted', cellPad)} />
              {colOrder.map((j, pos) => {
                const c = matrix.cols[j]
                const active = colTokens[j] !== null && colTokens[j] === token
                return (
                  <th
                    key={c.id}
                    scope="col"
                    className={cn(
                      'sticky top-0 z-10 bg-muted font-normal',
                      pos === firstLinkPos && 'border-l-2 border-l-foreground/40',
                      j === rhsIndex && 'border-l-2 border-l-foreground/40',
                      active && 'bg-accent-hl/25',
                    )}
                  >
                    <button
                      type="button"
                      className={cn('w-full whitespace-nowrap', cellPad, c.group === 'twig' && 'text-twig', c.group === 'link' && 'text-link')}
                      onClick={() => colTokens[j] && toggleHighlight({ token: colTokens[j]!, source: 'matrix-col' })}
                      disabled={!colTokens[j]}
                      aria-label={`Column ${c.label}${c.group ? ` (${c.group})` : ''}`}
                      aria-pressed={active}
                      title={c.group ? `${c.label} — ${c.group}` : c.label}
                    >
                      {c.kind === 'unknown' || c.kind === 'rhs' ? <Tex latex={c.latex} interactive={false} /> : c.label}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row, i) => {
              const rowActive = rowTokens[i] !== null && rowTokens[i] === token
              return (
                <tr key={row.id} className={cn(rowActive && 'bg-accent-hl/15')}>
                  <th scope="row" className={cn('sticky left-0 z-10 bg-muted text-left font-normal', rowActive && 'bg-accent-hl/25')}>
                    <button
                      type="button"
                      className={cn('w-full whitespace-nowrap text-left', cellPad)}
                      onClick={() => rowTokens[i] && toggleHighlight({ token: rowTokens[i]!, source: 'matrix-row' })}
                      disabled={!rowTokens[i]}
                      aria-label={`Row ${row.label}`}
                      aria-pressed={rowActive}
                    >
                      {row.label}
                    </button>
                  </th>
                  {colOrder.map((j, pos) => {
                    const v = matrix.data[i][j]
                    const colActive = colTokens[j] !== null && colTokens[j] === token
                    const isExplained = explained?.r === i && explained?.c === j
                    return (
                      <td
                        key={j}
                        className={cn(
                          'border-t border-border/50 text-right',
                          pos === firstLinkPos && 'border-l-2 border-l-foreground/40',
                          j === rhsIndex && 'border-l-2 border-l-foreground/40',
                          colActive && 'bg-accent-hl/15',
                          isExplained && 'outline-2 outline-accent-hl',
                        )}
                      >
                        <button
                          type="button"
                          className={cn('w-full tabular-nums', cellPad, v === 0 ? 'text-muted-foreground/50' : v > 0 ? 'text-foreground' : 'text-foreground font-medium')}
                          onClick={() => setExplained(isExplained ? null : { r: i, c: j })}
                          aria-label={`${row.label}, ${matrix.cols[j].label}: ${formatNumber(v)}`}
                        >
                          {v > 0 && Number.isInteger(v) && Math.abs(v) === 1 ? '+1' : formatNumber(v)}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {explained && (
        <div className="rounded-md border border-accent-hl/40 bg-accent-hl/5 px-2.5 py-1.5 text-xs" role="status">
          <span className="font-semibold">
            Why is entry ({matrix.rows[explained.r].label}, {matrix.cols[explained.c].label}) = {formatNumber(matrix.data[explained.r][explained.c])}?
          </span>{' '}
          {explainEntry(matrix, explained.r, explained.c, net, result)}
        </div>
      )}
    </div>
  )
}
