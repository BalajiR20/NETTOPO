import { useMemo } from 'react'
import type { Network } from '@/domain/network/types'
import type { AnalysisResult } from '@/domain/analysis/types'
import type { ResolvedHighlight } from '@/lib/highlight'
import { formatSI } from '@/engine/numerical'
import { cn } from '@/lib/utils'

interface Props {
  net: Network
  treeBranchIds?: string[] | null
  showTree?: boolean
  highlight: ResolvedHighlight | null
  result?: AnalysisResult | null
  referenceNodeId?: string | null
  onBranchClick?: (branchId: string) => void
  onNodeClick?: (nodeId: string) => void
  className?: string
  showFlow?: boolean
  compact?: boolean
}

/**
 * The linear oriented graph (§17.1): nodes as bubbles, branches as arrows.
 * Drawn from the NETWORK (not the schematic), so it is literally the
 * mathematical object the matrices are built from.
 */
export function GraphView({ net, treeBranchIds, showTree, highlight, result, referenceNodeId, onBranchClick, onNodeClick, className, showFlow, compact }: Props) {
  const layout = useMemo(() => {
    if (!net.nodes.length) return null
    const xs = net.nodes.map((n) => n.position.x)
    const ys = net.nodes.map((n) => n.position.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const pad = 70
    const pos = new Map(net.nodes.map((n) => [n.id, n.position]))
    // Parallel branches get increasing curvature.
    const pairIndex = new Map<string, number>()
    const curves = net.branches.map((b) => {
      const key = [b.fromNode, b.toNode].sort().join('|')
      const k = pairIndex.get(key) ?? 0
      pairIndex.set(key, k + 1)
      const total = net.branches.filter((x) => [x.fromNode, x.toNode].sort().join('|') === key).length
      const p = pos.get(b.fromNode)!
      const q = pos.get(b.toNode)!
      // A straight edge passing through another node bubble is bent around it.
      const blocked = net.nodes.some((n) => {
        if (n.id === b.fromNode || n.id === b.toNode) return false
        const r = n.position
        const dx0 = q.x - p.x
        const dy0 = q.y - p.y
        const l2 = dx0 * dx0 + dy0 * dy0 || 1
        const t = ((r.x - p.x) * dx0 + (r.y - p.y) * dy0) / l2
        if (t <= 0.02 || t >= 0.98) return false
        return Math.hypot(p.x + t * dx0 - r.x, p.y + t * dy0 - r.y) < 22
      })
      const offset = (total === 1 ? 0 : (k - (total - 1) / 2) * 46) + (blocked ? 70 : 0)
      // Keep the curve's bulge consistent regardless of branch direction.
      const canonical = b.fromNode < b.toNode ? 1 : -1
      const mx = (p.x + q.x) / 2
      const my = (p.y + q.y) / 2
      const dx = q.x - p.x
      const dy = q.y - p.y
      const len = Math.hypot(dx, dy) || 1
      const nx = (-dy / len) * offset * canonical
      const ny = (dx / len) * offset * canonical
      const cx = mx + nx * 2
      const cy = my + ny * 2
      // Mid-point of the quadratic curve.
      const midX = 0.25 * p.x + 0.5 * cx + 0.25 * q.x
      const midY = 0.25 * p.y + 0.5 * cy + 0.25 * q.y
      const tx = q.x - p.x + 0 // tangent at middle ∝ (q − p)
      const ty = q.y - p.y
      const angle = (Math.atan2(ty, tx) * 180) / Math.PI
      return { b, p, q, cx, cy, midX, midY, angle }
    })
    return { viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`, curves, pos }
  }, [net])

  if (!layout) return <div className={cn('grid place-items-center text-xs text-muted-foreground', className)}>Empty graph</div>
  const twigs = new Set(treeBranchIds ?? [])
  const maxI = result ? Math.max(1e-15, ...result.branches.map((q) => Math.abs(q.current))) : 1

  return (
    <svg viewBox={layout.viewBox} className={cn('h-full w-full select-none', className)} role="group" aria-label="Oriented linear graph of the network">
      <defs>
        <marker id="nt-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      {layout.curves.map(({ b, p, q, cx, cy, midX, midY, angle }) => {
        const inHl = highlight?.branchIds.has(b.id)
        const sign = highlight?.signs.get(b.id)
        const isTwig = twigs.has(b.id)
        const stroke = inHl ? 'var(--nt-highlight)' : showTree ? (isTwig ? 'var(--nt-twig)' : 'var(--nt-link)') : 'var(--nt-symbol)'
        const d = `M ${p.x} ${p.y} Q ${cx} ${cy} ${q.x} ${q.y}`
        const qty = result?.branches.find((x) => x.branchId === b.id)
        const flowDir = qty && qty.current !== 0 ? Math.sign(qty.current) : 0
        return (
          <g key={b.id}>
            <path d={d} stroke="transparent" strokeWidth={18} fill="none" className={onBranchClick ? 'cursor-pointer' : undefined} onClick={() => onBranchClick?.(b.id)}>
              <title>
                {b.label} ({b.elementLabel}): {net.nodes.find((n) => n.id === b.fromNode)?.label} → {net.nodes.find((n) => n.id === b.toNode)?.label}
              </title>
            </path>
            {inHl && <path d={d} stroke="var(--nt-highlight)" strokeOpacity={0.25} strokeWidth={12} fill="none" pointerEvents="none" />}
            <path
              d={d}
              stroke={stroke}
              strokeWidth={inHl || (showTree && isTwig) ? 3.5 : 2}
              strokeDasharray={showTree && !isTwig && !inHl ? '7 5' : undefined}
              fill="none"
              pointerEvents="none"
            />
            {showFlow && flowDir !== 0 && (
              <path
                d={flowDir > 0 ? d : `M ${q.x} ${q.y} Q ${cx} ${cy} ${p.x} ${p.y}`}
                className="nt-flow"
                stroke="var(--nt-current)"
                strokeWidth={3}
                fill="none"
                pointerEvents="none"
                opacity={0.35 + (0.65 * Math.abs(qty!.current)) / maxI}
              />
            )}
            <g transform={`translate(${midX} ${midY}) rotate(${angle})`} pointerEvents="none">
              <path d="M -7 -6 L 7 0 L -7 6 z" fill={stroke} />
            </g>
            <g pointerEvents="none" fontFamily="var(--font-mono)" fontSize={compact ? 13 : 12}>
              <text x={midX + 10} y={midY - 10} fill="currentColor" className="fill-foreground">
                {b.label}
              </text>
              {sign !== undefined && (
                <text x={midX + 10} y={midY + 18} fill="var(--nt-highlight)" fontWeight={700}>
                  {sign > 0 ? '+1' : '−1'}
                </text>
              )}
              {!compact && qty && sign === undefined && (
                <text x={midX + 10} y={midY + 18} fill="var(--nt-current)" fontSize={10.5}>
                  {formatSI(qty.current, 'A', 3)}
                </text>
              )}
            </g>
          </g>
        )
      })}
      {net.nodes.map((n) => {
        const p = layout.pos.get(n.id)!
        const isRef = n.id === referenceNodeId
        const tint =
          highlight?.kind === 'fcutset'
            ? highlight.sideFrom?.has(n.id)
              ? 'var(--nt-twig)'
              : 'var(--nt-link)'
            : highlight?.nodeIds.has(n.id)
              ? 'var(--nt-highlight)'
              : null
        return (
          <g key={n.id} transform={`translate(${p.x} ${p.y})`} className={onNodeClick ? 'cursor-pointer' : undefined} onClick={() => onNodeClick?.(n.id)}>
            {tint && <circle r={20} fill={tint} opacity={0.25} />}
            <circle r={13} fill="var(--nt-canvas)" stroke={isRef ? 'var(--nt-ref)' : tint ?? 'var(--nt-symbol)'} strokeWidth={isRef ? 3 : 2} strokeDasharray={isRef ? '4 2' : undefined} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontFamily="var(--font-mono)" className="fill-foreground" fontWeight={600}>
              {n.label.length > 4 ? n.label.slice(0, 4) : n.label}
            </text>
            <title>
              Node {n.label}
              {isRef ? ' (reference)' : ''}
            </title>
          </g>
        )
      })}
    </svg>
  )
}
