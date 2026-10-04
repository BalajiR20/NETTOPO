import regularUrl from '@/assets/fonts/DejaVuSans.ttf?url'
import boldUrl from '@/assets/fonts/DejaVuSans-Bold.ttf?url'
import monoUrl from '@/assets/fonts/DejaVuSansMono.ttf?url'
import type { AnalysisResult } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import type { Schematic } from '@/domain/schematic/types'
import { autoScale, drawScope, type TraceSpec } from '@/engine/simulation/scopeRender'
import { signalFromResult } from '@/engine/simulation'
import { formatSI } from '@/engine/numerical'
import type { ScopeChannel as Channel } from '@/engine/simulation'
import { buildReport, type ReportFonts } from './pdfReport'
import { canvasToPng, svgToPng } from './rasterize'
import { renderSchematicSvg } from './schematicSvg'

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(s)
}

let fontCache: Promise<ReportFonts | null> | null = null
/** Fonts are bundled with the app (offline); loaded lazily on first export. */
export function loadReportFonts(): Promise<ReportFonts | null> {
  fontCache ??= Promise.all([regularUrl, boldUrl, monoUrl].map((u) => fetch(u).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))))
    .then(([a, b, c]) => ({ regular: toBase64(a), bold: toBase64(b), mono: toBase64(c) }))
    .catch(() => null)
  return fontCache
}

export interface ExportInput {
  schematic: Schematic
  net: Network
  result: AnalysisResult
  projectName: string
  problem: string
  treeBranchIds: string[] | null
  referenceNodeId: string | null
  channels: Channel[]
  timePerDiv: number
}

export async function exportPdfReport(input: ExportInput): Promise<{ filename: string; pages: number }> {
  const fonts = await loadReportFonts()
  const tree = input.result.tree ? input.result.tree.tree.twigIds : null
  const base = renderSchematicSvg(input.schematic, input.net, { treeBranchIds: tree, referenceNodeId: input.result.referenceNodeId })
  const final = renderSchematicSvg(input.schematic, input.net, { result: input.result, showResults: true, referenceNodeId: input.result.referenceNodeId })
  const [circuitPng, finalPng] = await Promise.all([svgToPng(base.svg, base.width, base.height).catch(() => null), svgToPng(final.svg, final.width, final.height).catch(() => null)])

  // Oscilloscope: re-rendered off-screen from the same signal model as the live scope.
  const traces: TraceSpec[] = []
  for (const ch of input.channels) {
    if (!ch.enabled || !ch.targetId) continue
    const sig = signalFromResult(input.result, ch.quantity, ch.targetId)
    if (!sig) continue
    const v = sig.definition.kind === 'dc' ? sig.definition.value : 1
    traces.push({ signal: sig, scale: ch.scale || autoScale(v), offset: ch.offset, color: ch.color, channel: ch.id })
  }
  const SW = 640
  const SH = 300
  const scopePng = canvasToPng((ctx) => drawScope(ctx, { width: SW, height: SH, timePerDiv: input.timePerDiv, sweepStart: 0, sweepFraction: 1, traces }), SW, SH)
  const caption = traces.length
    ? traces.map((tr) => `CH${tr.channel}: ${tr.signal.label} = ${formatSI((tr.signal.definition as { value: number }).value, tr.signal.unit, 4)} (${formatSI(tr.scale, tr.signal.unit, 3)}/div)`).join('   ·   ') +
      `   ·   ${formatSI(input.timePerDiv, 's', 3)}/div. DC solution: every signal is constant.`
    : 'No oscilloscope channel was enabled.'

  const { doc } = buildReport({
    projectName: input.projectName,
    problem: input.problem,
    net: input.net,
    result: input.result,
    fonts,
    circuitImage: circuitPng ? { dataUrl: circuitPng, width: base.width, height: base.height } : null,
    finalCircuitImage: finalPng ? { dataUrl: finalPng, width: final.width, height: final.height } : null,
    scopeImage: scopePng ? { dataUrl: scopePng, width: SW, height: SH, caption } : null,
  })
  const slug = input.projectName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'nettopo'
  const filename = `${slug}-${input.result.method}-report.pdf`
  doc.save(filename)
  return { filename, pages: doc.getNumberOfPages() }
}
