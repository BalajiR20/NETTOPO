import type { AnalysisResult } from '@/domain/analysis/types'

/**
 * Simulation / signal model. The static circuit solution (AnalysisResult) is
 * kept separate from its time-domain representation. The oscilloscope only
 * consumes `SignalDefinition` through `evaluate()`, so AC and transient
 * analyses can be added later without changing the oscilloscope.
 */
export type SignalDefinition =
  | { kind: 'dc'; value: number }
  /** Sinusoidal steady state (future AC analysis). */
  | { kind: 'sinusoid'; amplitude: number; frequency: number; phase: number; offset: number }
  /** Sampled waveform (future transient analysis); linear interpolation, held at the ends. */
  | { kind: 'sampled'; t: number[]; y: number[] }

export type SignalQuantity = 'branch-current' | 'branch-voltage' | 'node-voltage' | 'branch-power'

export interface OscilloscopeSignal {
  id: string
  quantity: SignalQuantity
  targetId: string
  label: string
  unit: 'A' | 'V' | 'W'
  definition: SignalDefinition
  /** Analysis method that produced the value (provenance). */
  method: AnalysisResult['method']
  computedAt: number
}

/** Oscilloscope channel configuration (shared by the live scope and the report). */
export interface ScopeChannel {
  id: 1 | 2 | 3 | 4
  enabled: boolean
  quantity: SignalQuantity
  targetId: string | null
  /** Units per vertical division. 0 = auto. */
  scale: number
  /** Vertical offset in divisions. */
  offset: number
  color: string
}

export function evaluate(def: SignalDefinition, t: number): number {
  switch (def.kind) {
    case 'dc':
      return def.value
    case 'sinusoid':
      return def.offset + def.amplitude * Math.cos(2 * Math.PI * def.frequency * t + def.phase)
    case 'sampled': {
      const { t: ts, y } = def
      if (ts.length === 0) return 0
      if (t <= ts[0]) return y[0]
      if (t >= ts[ts.length - 1]) return y[y.length - 1]
      let lo = 0
      let hi = ts.length - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (ts[mid] <= t) lo = mid
        else hi = mid
      }
      const f = (t - ts[lo]) / (ts[hi] - ts[lo])
      return y[lo] + f * (y[hi] - y[lo])
    }
  }
}

export function sample(def: SignalDefinition, t0: number, t1: number, n: number): { t: number[]; y: number[] } {
  const t: number[] = []
  const y: number[] = []
  for (let k = 0; k < n; k++) {
    const tk = t0 + ((t1 - t0) * k) / Math.max(1, n - 1)
    t.push(tk)
    y.push(evaluate(def, tk))
  }
  return { t, y }
}

export interface Measurements {
  mean: number
  min: number
  max: number
  peakToPeak: number
  rms: number
}

export function measure(def: SignalDefinition, t0: number, t1: number, n = 512): Measurements {
  const { y } = sample(def, t0, t1, n)
  const min = Math.min(...y)
  const max = Math.max(...y)
  const mean = y.reduce((a, b) => a + b, 0) / y.length
  const rms = Math.sqrt(y.reduce((a, b) => a + b * b, 0) / y.length)
  return { mean, min, max, peakToPeak: max - min, rms }
}

export interface SignalOption {
  quantity: SignalQuantity
  targetId: string
  label: string
  unit: 'A' | 'V' | 'W'
}

export function availableSignals(result: AnalysisResult): SignalOption[] {
  const net = result.networkSnapshot
  const out: SignalOption[] = []
  for (const b of net.branches) out.push({ quantity: 'branch-current', targetId: b.id, label: `i${b.index} — ${b.elementLabel} (${b.label})`, unit: 'A' })
  for (const b of net.branches) out.push({ quantity: 'branch-voltage', targetId: b.id, label: `v${b.index} — ${b.elementLabel} (${b.label})`, unit: 'V' })
  for (const n of net.nodes)
    out.push({
      quantity: 'node-voltage',
      targetId: n.id,
      label: `vₙ(${n.label}) w.r.t. ${net.nodes.find((x) => x.id === result.potentialReferenceNodeId)?.label}`,
      unit: 'V',
    })
  for (const b of net.branches) out.push({ quantity: 'branch-power', targetId: b.id, label: `p${b.index} — ${b.elementLabel} (absorbed)`, unit: 'W' })
  return out
}

/** Builds a signal from the ACTUAL analysis result. Returns null if the target no longer exists. */
export function signalFromResult(result: AnalysisResult, quantity: SignalQuantity, targetId: string): OscilloscopeSignal | null {
  const net = result.networkSnapshot
  let value: number | undefined
  let label = ''
  let unit: OscilloscopeSignal['unit'] = 'V'
  const b = net.branches.find((x) => x.id === targetId)
  switch (quantity) {
    case 'branch-current':
      value = result.branchCurrents[targetId]
      label = b ? `i${b.index} (${b.elementLabel})` : ''
      unit = 'A'
      break
    case 'branch-voltage':
      value = result.branchVoltages[targetId]
      label = b ? `v${b.index} (${b.elementLabel})` : ''
      break
    case 'branch-power':
      value = result.branches.find((q) => q.branchId === targetId)?.power
      label = b ? `p${b.index} (${b.elementLabel})` : ''
      unit = 'W'
      break
    case 'node-voltage': {
      value = result.nodeVoltages[targetId]
      const n = net.nodes.find((x) => x.id === targetId)
      label = n ? `vₙ(${n.label})` : ''
      break
    }
  }
  if (value === undefined || !Number.isFinite(value)) return null
  return { id: `${quantity}:${targetId}`, quantity, targetId, label, unit, definition: { kind: 'dc', value }, method: result.method, computedAt: result.computedAt }
}
