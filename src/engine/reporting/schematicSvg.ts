import type { AnalysisResult } from '@/domain/analysis/types'
import { ELEMENT_DESCRIPTORS } from '@/domain/elements'
import type { Network } from '@/domain/network/types'
import { pinADirection, pinPosition } from '@/domain/schematic/geometry'
import type { Schematic } from '@/domain/schematic/types'
import { formatSI, formatValue } from '@/engine/numerical'
import { GROUND_PATH, ORIENTATION_ARROW, SYMBOL_PATHS } from '@/lib/symbols'

/**
 * Pure SVG renderer of the schematic, independent of React Flow, so reports
 * render exactly the same circuit from the domain model. Light theme.
 */
export interface SvgOptions {
  result?: AnalysisResult | null
  treeBranchIds?: string[] | null
  referenceNodeId?: string | null
  showResults?: boolean
  sig?: number
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const sub = (k: number) =>
  String(k)
    .split('')
    .map((d) => SUB[Number(d)])
    .join('')

export function renderSchematicSvg(s: Schematic, net: Network, opts: SvgOptions = {}): { svg: string; width: number; height: number } {
  const sig = opts.sig ?? 3
  const C = { wire: '#334155', sym: '#0f172a', twig: '#15803d', link: '#c2410c', ref: '#7e22ce', i: '#c2410c', v: '#1d4ed8', muted: '#64748b' }
  const pts: { x: number; y: number }[] = []
  for (const c of s.components) pts.push({ x: c.position.x - 60, y: c.position.y - 60 }, { x: c.position.x + 60, y: c.position.y + 60 })
  for (const m of s.markers) pts.push(m.position)
  for (const g of s.grounds) pts.push({ x: g.position.x, y: g.position.y + 30 })
  if (!pts.length) pts.push({ x: 0, y: 0 })
  const pad = 70
  const minX = Math.min(...pts.map((p) => p.x)) - pad
  const minY = Math.min(...pts.map((p) => p.y)) - pad
  const width = Math.max(...pts.map((p) => p.x)) + pad - minX
  const height = Math.max(...pts.map((p) => p.y)) + pad - minY
  const parts: string[] = []
  const twigs = new Set(opts.treeBranchIds ?? [])
  const showTree = (opts.treeBranchIds?.length ?? 0) > 0
  const pinNode = new Map<string, string>()
  for (const n of net.nodes) for (const k of n.pinKeys) pinNode.set(k, n.id)

  // Wires (same routing rule as the canvas)
  for (const w of s.wires) {
    const a = pinPosition(s, w.from.ownerId, w.from.pin)
    const b = pinPosition(s, w.to.ownerId, w.to.pin)
    if (!a || !b) continue
    const comp = s.components.find((c) => c.id === w.from.ownerId)
    const horizontalFirst = comp ? comp.rotation === 0 || comp.rotation === 180 : false
    const d =
      Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5
        ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
        : horizontalFirst
          ? `M ${a.x} ${a.y} L ${b.x} ${a.y} L ${b.x} ${b.y}`
          : `M ${a.x} ${a.y} L ${a.x} ${b.y} L ${b.x} ${b.y}`
    const isRef = opts.referenceNodeId && pinNode.get(`${w.from.ownerId}:${w.from.pin}`) === opts.referenceNodeId
    parts.push(`<path d="${d}" stroke="${isRef ? C.ref : C.wire}" stroke-width="1.8" fill="none"/>`)
  }

  // Components
  for (const c of s.components) {
    const b = net.branches.find((x) => x.id === c.id)
    const sym = SYMBOL_PATHS[c.kind]
    const color = showTree ? (twigs.has(c.id) ? C.twig : C.link) : C.sym
    const dash = showTree && !twigs.has(c.id) ? ' stroke-dasharray="6 4"' : ''
    const g: string[] = [`<g transform="translate(${c.position.x} ${c.position.y}) rotate(${c.rotation})">`]
    if (sym.circle) g.push(`<circle r="${sym.circle.r}" fill="#fff" stroke="${color}" stroke-width="2"/>`)
    g.push(`<path d="${sym.stroke}" stroke="${color}" stroke-width="2" fill="none" stroke-linejoin="round"${dash}/>`)
    if (sym.fill) g.push(`<path d="${sym.fill}" fill="${color}"/>`)
    g.push(
      `<g transform="translate(0 ${c.kind === 'resistor' ? -15 : -22}) ${c.reversed ? 'rotate(180)' : ''}"><path d="${ORIENTATION_ARROW.line}" stroke="${C.v}" stroke-width="1.2"/><path d="${ORIENTATION_ARROW.head}" fill="${C.v}"/></g>`,
    )
    g.push('</g>')
    parts.push(g.join(''))
    const horizontal = c.rotation === 0 || c.rotation === 180
    const lx = horizontal ? c.position.x : c.position.x - 30
    const ly = horizontal ? c.position.y - 30 : c.position.y
    const anchor = horizontal ? 'middle' : 'end'
    parts.push(
      `<text x="${lx}" y="${ly}" font-size="12" text-anchor="${anchor}" font-family="DejaVu Sans, sans-serif" fill="${C.sym}"><tspan font-weight="bold">${esc(c.label)}</tspan> <tspan fill="${C.muted}">b${b?.index ?? ''} · ${esc(formatValue(c.value, ELEMENT_DESCRIPTORS[c.kind].unit))}</tspan></text>`,
    )
    const q = opts.showResults ? opts.result?.branches.find((x) => x.branchId === c.id) : undefined
    if (q && b) {
      const dA = pinADirection(c.rotation)
      const ref = c.reversed ? dA : { x: -dA.x, y: -dA.y }
      const arrow = ref.x > 0 ? '→' : ref.x < 0 ? '←' : ref.y > 0 ? '↓' : '↑'
      const rx = horizontal ? c.position.x : c.position.x + 30
      const ry = horizontal ? c.position.y + 36 : c.position.y - 6
      const anchor2 = horizontal ? 'middle' : 'start'
      parts.push(
        `<text x="${rx}" y="${ry}" font-size="11" text-anchor="${anchor2}" font-family="DejaVu Sans Mono, monospace"><tspan fill="${C.i}">${arrow} i${sub(b.index)} = ${esc(formatSI(q.current, 'A', sig))}</tspan><tspan x="${rx}" dy="14" fill="${C.v}">v${sub(b.index)} = ${esc(formatSI(q.voltage, 'V', sig))}</tspan></text>`,
      )
    }
  }

  // Markers
  for (const m of s.markers) {
    const nid = pinNode.get(`${m.id}:p`)
    const node = net.nodes.find((n) => n.id === nid)
    const isRef = !!nid && nid === opts.referenceNodeId
    if (m.kind === 'junction') {
      parts.push(`<circle cx="${m.position.x}" cy="${m.position.y}" r="4" fill="${isRef ? C.ref : C.wire}"/>`)
      continue
    }
    parts.push(`<circle cx="${m.position.x}" cy="${m.position.y}" r="7" fill="#fff" stroke="${isRef ? C.ref : C.wire}" stroke-width="2.5"/>`)
    const v = opts.showResults && opts.result && nid ? opts.result.nodeVoltages[nid] - opts.result.nodeVoltages[opts.result.potentialReferenceNodeId] : null
    parts.push(
      `<text x="${m.position.x + 10}" y="${m.position.y + 18}" font-size="12" font-weight="bold" font-family="DejaVu Sans Mono, monospace" fill="${isRef ? C.ref : C.sym}">${esc(node?.label ?? m.label)}${isRef ? ' (ref)' : ''}${v !== null ? `<tspan font-weight="normal" fill="${C.v}"> ${esc(formatSI(v, 'V', sig))}</tspan>` : ''}</text>`,
    )
  }
  for (const g of s.grounds) {
    parts.push(`<g transform="translate(${g.position.x} ${g.position.y})"><path d="${GROUND_PATH}" stroke="${C.sym}" stroke-width="2" fill="none"/></g>`)
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}"><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#ffffff"/>${parts.join('')}</svg>`
  return { svg, width, height }
}
