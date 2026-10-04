import { useEffect, useMemo, useRef } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { AnalysisResult } from '@/domain/analysis/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { availableSignals, measure, signalFromResult, type OscilloscopeSignal, type SignalQuantity } from '@/engine/simulation'
import { formatSI } from '@/engine/numerical'
import { cn } from '@/lib/utils'
import { useSimulationStore, type Channel } from '@/store/simulationStore'
import { autoScale, drawScope, DIV_X, type TraceSpec } from '@/engine/simulation/scopeRender'

const TIME_STEPS = [1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1]
const SCALE_STEPS = [0, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
/** Real seconds per full sweep: the display speed (simulated time is scaled to it). */
const SWEEP_SECONDS = 2

const QUANTITY_LABEL: Record<SignalQuantity, string> = {
  'branch-current': 'Branch currents',
  'branch-voltage': 'Branch voltages',
  'node-voltage': 'Node voltages',
  'branch-power': 'Branch power (absorbed)',
}

export function Oscilloscope({ result }: { result: AnalysisResult | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const channels = useSimulationStore((s) => s.channels)
  const running = useSimulationStore((s) => s.running)
  const timePerDiv = useSimulationStore((s) => s.timePerDiv)
  const resetNonce = useSimulationStore((s) => s.resetNonce)
  const setChannel = useSimulationStore((s) => s.setChannel)
  const timeRef = useRef(0)

  const options = useMemo(() => (result ? availableSignals(result) : []), [result])

  // Assign sensible default targets from the actual result when a channel has none.
  useEffect(() => {
    if (!result) return
    const net = result.networkSnapshot
    for (const ch of useSimulationStore.getState().channels) {
      const valid = ch.targetId && options.some((o) => o.quantity === ch.quantity && o.targetId === ch.targetId)
      if (valid) continue
      let target: string | null = null
      if (ch.quantity === 'node-voltage') target = net.nodes.find((n) => n.id !== result.potentialReferenceNodeId)?.id ?? null
      else target = net.branches.find((b) => b.element.type === 'resistor')?.id ?? net.branches[0]?.id ?? null
      setChannel(ch.id, { targetId: target })
    }
  }, [result, options, setChannel])

  const traces: (TraceSpec & { ch: Channel })[] = useMemo(() => {
    if (!result) return []
    const out: (TraceSpec & { ch: Channel })[] = []
    for (const ch of channels) {
      if (!ch.enabled || !ch.targetId) continue
      const sig = signalFromResult(result, ch.quantity, ch.targetId)
      if (!sig) continue
      const dcValue = sig.definition.kind === 'dc' ? sig.definition.value : 1
      out.push({ signal: sig, scale: ch.scale || autoScale(dcValue), offset: ch.offset, color: ch.color, channel: ch.id, ch })
    }
    return out
  }, [result, channels])

  useEffect(() => {
    timeRef.current = 0
  }, [resetNonce])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const sweepDuration = DIV_X * timePerDiv
      if (running) timeRef.current += (dt / SWEEP_SECONDS) * sweepDuration
      const dpr = window.devicePixelRatio || 1
      const W = box.clientWidth
      const H = box.clientHeight
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const t = timeRef.current
        const sweepStart = Math.floor(t / sweepDuration) * sweepDuration
        drawScope(ctx, {
          width: W,
          height: H,
          timePerDiv,
          sweepStart,
          sweepFraction: (t - sweepStart) / sweepDuration,
          traces,
          message: !result ? 'NO SIGNAL — run an analysis' : traces.length === 0 ? 'No channel enabled' : undefined,
        })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [traces, running, timePerDiv, result])

  const grouped = useMemo(() => {
    const g = new Map<SignalQuantity, typeof options>()
    for (const o of options) {
      if (!g.has(o.quantity)) g.set(o.quantity, [])
      g.get(o.quantity)!.push(o)
    }
    return g
  }, [options])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3 lg:flex-row" data-testid="oscilloscope">
      <div className="flex min-h-48 min-w-0 flex-1 flex-col gap-1">
        <div ref={boxRef} className="relative min-h-44 flex-1 overflow-hidden rounded-md border border-black/40 shadow-inner">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" role="img" aria-label={`Oscilloscope display. ${traces.map((t) => `Channel ${t.channel}: ${t.signal.label} = ${formatSI((t.signal.definition as { value: number }).value, t.signal.unit, 4)}`).join('. ')}`} />
          <div className="pointer-events-none absolute left-2 top-1.5 flex flex-col gap-0.5 font-mono text-[10.5px]">
            {traces.map((t) => {
              const m = measure(t.signal.definition, 0, DIV_X * timePerDiv, 64)
              return (
                <span key={t.channel} style={{ color: t.color }}>
                  CH{t.channel} {t.signal.label} · {formatSI(t.scale, t.signal.unit, 3)}/div · mean {formatSI(m.mean, t.signal.unit, 4)} · p-p {formatSI(m.peakToPeak, t.signal.unit, 3)}
                </span>
              )
            })}
          </div>
          <div className="pointer-events-none absolute bottom-6 right-2 font-mono text-[10px] text-emerald-200/70">
            {formatSI(timePerDiv, 's', 3)}/div · {result ? `DC solution · ${result.method}` : 'idle'}
          </div>
        </div>
        <p className="text-[10.5px] text-muted-foreground">
          DC analysis: each signal is the constant computed value, s(t) = const. The sweep runs at {SWEEP_SECONDS} s of real time per screen. Values come from the current analysis result, never from synthetic data.
        </p>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 lg:w-80">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant={running ? 'secondary' : 'default'} onClick={() => useSimulationStore.getState().setRunning(!running)} aria-label={running ? 'Pause' : 'Run'}>
            {running ? <Pause /> : <Play />} {running ? 'Pause' : 'Run'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => useSimulationStore.getState().reset()}>
            <RotateCcw /> Reset
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10.5px] text-muted-foreground">Time/div</span>
            <Select value={String(timePerDiv)} onValueChange={(v) => useSimulationStore.getState().setTimePerDiv(Number(v))}>
              <SelectTrigger size="sm" className="h-7 w-24 font-mono text-xs" aria-label="Time scale per division">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_STEPS.map((t) => (
                  <SelectItem key={t} value={String(t)} className="font-mono text-xs">
                    {formatSI(t, 's', 3)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {channels.map((ch) => {
          const tr = traces.find((t) => t.channel === ch.id)
          const unit = ch.quantity === 'branch-current' ? 'A' : ch.quantity === 'branch-power' ? 'W' : 'V'
          return (
            <div key={ch.id} className={cn('flex flex-col gap-1 rounded-md border p-1.5', !ch.enabled && 'opacity-60')}>
              <div className="flex items-center gap-1.5">
                <Switch checked={ch.enabled} onCheckedChange={(v) => setChannel(ch.id, { enabled: v })} aria-label={`Enable channel ${ch.id}`} />
                <span className="font-mono text-xs font-semibold" style={{ color: ch.color }}>
                  CH{ch.id}
                </span>
                <Select
                  value={ch.targetId ? `${ch.quantity}|${ch.targetId}` : ''}
                  onValueChange={(v) => {
                    const [q, id] = v.split('|')
                    setChannel(ch.id, { quantity: q as SignalQuantity, targetId: id, scale: 0 })
                  }}
                  disabled={!result}
                >
                  <SelectTrigger size="sm" className="h-7 min-w-0 flex-1 text-xs" aria-label={`Channel ${ch.id} signal`}>
                    <SelectValue placeholder={result ? 'Select signal' : 'No result'} />
                  </SelectTrigger>
                  <SelectContent>
                    {[...grouped.entries()].map(([q, opts]) => (
                      <SelectGroup key={q}>
                        <SelectLabel>{QUANTITY_LABEL[q]}</SelectLabel>
                        {opts.map((o) => (
                          <SelectItem key={`${o.quantity}|${o.targetId}`} value={`${o.quantity}|${o.targetId}`} className="text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5 pl-10">
                <span className="text-[10.5px] text-muted-foreground">Scale</span>
                <Select value={String(ch.scale)} onValueChange={(v) => setChannel(ch.id, { scale: Number(v) })}>
                  <SelectTrigger size="sm" className="h-6 w-24 font-mono text-[11px]" aria-label={`Channel ${ch.id} amplitude scale`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCALE_STEPS.map((s) => (
                      <SelectItem key={s} value={String(s)} className="font-mono text-xs">
                        {s === 0 ? 'auto' : `${formatSI(s, unit, 3)}/div`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10.5px] text-muted-foreground">Offset</span>
                <Button size="icon-xs" variant="outline" onClick={() => setChannel(ch.id, { offset: ch.offset - 1 })} aria-label={`Channel ${ch.id} offset down`}>
                  −
                </Button>
                <span className="w-6 text-center font-mono text-[11px]">{ch.offset}</span>
                <Button size="icon-xs" variant="outline" onClick={() => setChannel(ch.id, { offset: ch.offset + 1 })} aria-label={`Channel ${ch.id} offset up`}>
                  +
                </Button>
              </div>
              {tr && <div className="pl-10 font-mono text-[11px]" style={{ color: ch.color }}>{formatSI((tr.signal.definition as { value: number }).value, tr.signal.unit, 5)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { OscilloscopeSignal }
