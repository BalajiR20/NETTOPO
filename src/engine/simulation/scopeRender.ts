import { evaluate, type OscilloscopeSignal } from './index'
import { formatSI } from '@/engine/numerical'

export const DIV_X = 10
export const DIV_Y = 8

export interface TraceSpec {
  signal: OscilloscopeSignal
  /** units per division */
  scale: number
  offset: number
  color: string
  channel: number
}

/** 1-2-5 sequence scale so that |value| occupies about 3 divisions. */
export function autoScale(value: number): number {
  const target = Math.abs(value) / 3
  if (target === 0) return 1
  const exp = Math.floor(Math.log10(target))
  for (const m of [1, 2, 5, 10]) {
    const s = m * 10 ** exp
    if (s >= target) return s
  }
  return 10 ** (exp + 1)
}

export interface RenderOptions {
  width: number
  height: number
  timePerDiv: number
  /** Simulation time at the left edge of the current sweep. */
  sweepStart: number
  /** Fraction (0..1) of the sweep already drawn. */
  sweepFraction: number
  traces: TraceSpec[]
  message?: string
}

/** Pure drawing routine so the PDF report can render the same scope image off-screen. */
export function drawScope(ctx: CanvasRenderingContext2D, o: RenderOptions) {
  const { width: W, height: H } = o
  const padL = 8
  const padR = 8
  const padT = 8
  const padB = 22
  const w = W - padL - padR
  const h = H - padT - padB
  const dx = w / DIV_X
  const dy = h / DIV_Y

  ctx.save()
  ctx.fillStyle = '#0a0f14'
  ctx.fillRect(0, 0, W, H)
  ctx.translate(padL, padT)

  // Grid
  ctx.strokeStyle = 'rgba(120, 160, 140, 0.18)'
  ctx.lineWidth = 1
  for (let i = 0; i <= DIV_X; i++) {
    ctx.beginPath()
    ctx.moveTo(Math.round(i * dx) + 0.5, 0)
    ctx.lineTo(Math.round(i * dx) + 0.5, h)
    ctx.stroke()
  }
  for (let j = 0; j <= DIV_Y; j++) {
    ctx.beginPath()
    ctx.moveTo(0, Math.round(j * dy) + 0.5)
    ctx.lineTo(w, Math.round(j * dy) + 0.5)
    ctx.stroke()
  }
  // Centre axes with ticks
  ctx.strokeStyle = 'rgba(140, 190, 165, 0.45)'
  ctx.beginPath()
  ctx.moveTo(0, h / 2 + 0.5)
  ctx.lineTo(w, h / 2 + 0.5)
  ctx.moveTo(w / 2 + 0.5, 0)
  ctx.lineTo(w / 2 + 0.5, h)
  ctx.stroke()
  for (let i = 0; i <= DIV_X * 5; i++) {
    const x = Math.round((i * dx) / 5) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, h / 2 - 3)
    ctx.lineTo(x, h / 2 + 3)
    ctx.stroke()
  }
  for (let j = 0; j <= DIV_Y * 5; j++) {
    const y = Math.round((j * dy) / 5) + 0.5
    ctx.beginPath()
    ctx.moveTo(w / 2 - 3, y)
    ctx.lineTo(w / 2 + 3, y)
    ctx.stroke()
  }

  // Traces
  const cursorX = o.sweepFraction * w
  for (const tr of o.traces) {
    const toY = (val: number) => h / 2 - (val / tr.scale + tr.offset) * dy
    // Ground marker for the channel
    const y0 = toY(0)
    ctx.fillStyle = tr.color
    ctx.beginPath()
    ctx.moveTo(-1, y0 - 5)
    ctx.lineTo(6, y0)
    ctx.lineTo(-1, y0 + 5)
    ctx.fill()

    const draw = (x0: number, x1: number, tStart: number, alpha: number) => {
      if (x1 <= x0) return
      ctx.strokeStyle = tr.color
      ctx.globalAlpha = alpha
      ctx.lineWidth = 2
      ctx.shadowColor = tr.color
      ctx.shadowBlur = alpha > 0.5 ? 6 : 0
      ctx.beginPath()
      const steps = Math.max(2, Math.ceil(x1 - x0))
      for (let k = 0; k <= steps; k++) {
        const x = x0 + ((x1 - x0) * k) / steps
        const t = tStart + (x / w) * DIV_X * o.timePerDiv
        const y = Math.max(-2, Math.min(h + 2, toY(evaluate(tr.signal.definition, t))))
        if (k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }
    // Previous sweep (persistence) to the right of the cursor, current sweep to the left.
    draw(cursorX, w, o.sweepStart - DIV_X * o.timePerDiv, 0.35)
    draw(0, cursorX, o.sweepStart, 1)
    // Channel tag at the right edge so overlapping traces stay identifiable.
    const yEnd = Math.max(8, Math.min(h - 8, toY(evaluate(tr.signal.definition, o.sweepStart))))
    ctx.font = 'bold 10px ui-monospace, monospace'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = tr.color
    ctx.fillText(`${tr.channel}`, w - 10 - (tr.channel - 1) * 11, yEnd - 7)
  }

  // Sweep cursor
  if (o.traces.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(cursorX + 0.5, 0)
    ctx.lineTo(cursorX + 0.5, h)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Time axis labels
  ctx.fillStyle = 'rgba(190, 220, 205, 0.8)'
  ctx.font = '10px ui-monospace, monospace'
  ctx.textBaseline = 'top'
  for (let i = 0; i <= DIV_X; i += 2) {
    const t = o.sweepStart + i * o.timePerDiv
    const label = formatSI(t, 's', 3)
    const tw = ctx.measureText(label).width
    ctx.fillText(label, Math.min(w - tw, Math.max(0, i * dx - tw / 2)), h + 6)
  }

  if (o.message) {
    ctx.fillStyle = 'rgba(190, 220, 205, 0.75)'
    ctx.font = '13px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(o.message, w / 2, h / 2 - 18)
    ctx.textAlign = 'start'
  }
  ctx.restore()
}
