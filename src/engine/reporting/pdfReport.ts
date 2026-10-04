import { jsPDF } from 'jspdf'
import { METHODS } from '@/domain/analysis/methods'
import type { AnalysisResult } from '@/domain/analysis/types'
import { ELEMENT_DESCRIPTORS } from '@/domain/elements'
import type { Network } from '@/domain/network/types'
import type { LabeledMatrix } from '@/domain/topology/types'
import { formatNumber, formatResidual, formatSI, formatValue } from '@/engine/numerical'
import { equationText } from '@/engine/solvers/common/model'
import { componentCount } from '@/engine/graph'
import { countSpanningTrees } from '@/engine/topology'

export interface ReportFonts {
  regular: string // base64 TTF
  bold: string
  mono: string
}

export interface ReportInput {
  projectName: string
  problem: string
  net: Network
  result: AnalysisResult
  circuitImage?: { dataUrl: string; width: number; height: number } | null
  finalCircuitImage?: { dataUrl: string; width: number; height: number } | null
  scopeImage?: { dataUrl: string; width: number; height: number; caption: string } | null
  fonts?: ReportFonts | null
  generatedAt?: Date
}

export interface ReportOutput {
  doc: jsPDF
  /** Section titles in order (used by tests and the export dialog). */
  outline: string[]
}

const PAGE = { w: 210, h: 297, m: 16 }

/** LaTeX matrix symbol → plain text: B_f → Bf, M\,|\,r → M | r. */
export const plainSymbol = (s: string) =>
  s
    .replace(/\\,/g, ' ')
    .replace(/[\\{}_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

class Writer {
  y = PAGE.m
  outline: string[] = []
  private sans: string
  private mono: string
  doc: jsPDF
  constructor(doc: jsPDF, fonts: boolean) {
    this.doc = doc
    this.sans = fonts ? 'DejaVu' : 'helvetica'
    this.mono = fonts ? 'DejaVuMono' : 'courier'
  }
  get width() {
    return PAGE.w - 2 * PAGE.m
  }
  ensure(h: number) {
    if (this.y + h > PAGE.h - PAGE.m - 6) this.newPage()
  }
  newPage() {
    this.doc.addPage()
    this.y = PAGE.m
  }
  font(kind: 'sans' | 'bold' | 'mono', size: number, color: [number, number, number] = [15, 23, 42]) {
    this.doc.setFont(kind === 'mono' ? this.mono : this.sans, kind === 'bold' ? 'bold' : 'normal')
    this.doc.setFontSize(size)
    this.doc.setTextColor(...color)
  }
  section(title: string, keepWith = 22) {
    this.outline.push(title)
    this.ensure(10 + keepWith)
    this.y += 3
    this.font('bold', 12.5, [15, 23, 42])
    this.doc.text(title, PAGE.m, this.y)
    this.y += 1.8
    this.doc.setDrawColor(56, 189, 248)
    this.doc.setLineWidth(0.5)
    this.doc.line(PAGE.m, this.y, PAGE.m + this.width, this.y)
    this.y += 5
  }
  sub(title: string) {
    this.ensure(10)
    this.font('bold', 10)
    this.doc.text(title, PAGE.m, this.y)
    this.y += 5
  }
  para(text: string, opts: { size?: number; mono?: boolean; color?: [number, number, number]; indent?: number } = {}) {
    const size = opts.size ?? 9.5
    this.font(opts.mono ? 'mono' : 'sans', size, opts.color)
    const lines = this.doc.splitTextToSize(text, this.width - (opts.indent ?? 0)) as string[]
    const lh = size * 0.42
    for (const l of lines) {
      this.ensure(lh + 1)
      this.doc.text(l, PAGE.m + (opts.indent ?? 0), this.y)
      this.y += lh
    }
    this.y += 1.5
  }
  kv(rows: [string, string][]) {
    for (const [k, v] of rows) {
      this.ensure(5)
      this.font('sans', 9.5, [71, 85, 105])
      this.doc.text(k, PAGE.m, this.y)
      this.font('mono', 9.5)
      this.doc.text(v, PAGE.m + 62, this.y)
      this.y += 4.6
    }
    this.y += 1.5
  }
  table(columns: string[], rows: string[][], widths?: number[]) {
    const n = columns.length
    const w = widths ?? new Array(n).fill(this.width / n)
    const rowH = 5.2
    const header = () => {
      this.ensure(rowH * 2)
      this.doc.setFillColor(241, 245, 249)
      this.doc.rect(PAGE.m, this.y - 3.8, this.width, rowH, 'F')
      this.font('bold', 8.5, [51, 65, 85])
      let x = PAGE.m + 1
      columns.forEach((c, i) => {
        this.doc.text(c, x, this.y)
        x += w[i]
      })
      this.y += rowH
    }
    header()
    for (const r of rows) {
      this.font('mono', 8.5)
      const cells = r.map((c, i) => this.doc.splitTextToSize(c, w[i] - 2) as string[])
      const lines = Math.max(1, ...cells.map((c) => c.length))
      const h = rowH + (lines - 1) * 3.6
      if (this.y + h > PAGE.h - PAGE.m - 6) {
        this.newPage()
        header()
        this.font('mono', 8.5)
      }
      let x = PAGE.m + 1
      cells.forEach((c, i) => {
        c.forEach((line, k) => this.doc.text(line, x, this.y + k * 3.6))
        x += w[i]
      })
      this.doc.setDrawColor(226, 232, 240)
      this.doc.setLineWidth(0.15)
      this.doc.line(PAGE.m, this.y + h - rowH + 1.4, PAGE.m + this.width, this.y + h - rowH + 1.4)
      this.y += h
    }
    this.y += 2
  }
  matrix(m: LabeledMatrix) {
    const cols = m.cols.length
    const labelW = Math.min(30, Math.max(12, ...m.rows.map((r) => r.label.length * 1.7)))
    const cellW = Math.min(14, (this.width - labelW - 6) / Math.max(1, cols))
    const size = cellW < 9 ? 6.5 : 8
    const rowH = size * 0.5
    const h = (m.rows.length + 1) * rowH + 4
    if (h > PAGE.h - 2 * PAGE.m - 10 || cellW < 6) {
      this.para(`(${m.rows.length}×${cols} matrix — too large to typeset; see the application for the full interactive matrix.)`, { size: 8.5 })
      return
    }
    this.ensure(h + 4)
    this.font('bold', size, [71, 85, 105])
    const x0 = PAGE.m + labelW
    m.cols.forEach((c, j) => {
      const label = c.label.length > 7 ? c.label.slice(0, 7) : c.label
      this.doc.text(label, x0 + 2 + j * cellW + cellW - 1, this.y, { align: 'right' })
    })
    this.y += rowH
    const top = this.y - rowH + 1
    m.rows.forEach((r, i) => {
      this.font('sans', size, [71, 85, 105])
      this.doc.text(r.label.length > 18 ? r.label.slice(0, 18) : r.label, PAGE.m, this.y)
      this.font('mono', size)
      m.data[i].forEach((v, j) => {
        this.doc.setTextColor(...((v === 0 ? [148, 163, 184] : [15, 23, 42]) as [number, number, number]))
        this.doc.text(formatNumber(v, 4), x0 + 2 + j * cellW + cellW - 1, this.y, { align: 'right' })
      })
      this.y += rowH
    })
    const bottom = this.y - rowH + 1.5
    const right = x0 + 2 + cols * cellW + 1
    this.doc.setDrawColor(15, 23, 42)
    this.doc.setLineWidth(0.3)
    // brackets
    this.doc.lines([[-1.2, 0], [0, bottom - top], [1.2, 0]], x0 + 1.2, top)
    this.doc.lines([[1.2, 0], [0, bottom - top], [-1.2, 0]], right - 1.2, top)
    this.y += 3
  }
  image(dataUrl: string, w: number, h: number, maxH = 110) {
    const scale = Math.min(this.width / w, maxH / h)
    const iw = w * scale
    const ih = h * scale
    this.ensure(ih + 4)
    this.doc.addImage(dataUrl, 'PNG', PAGE.m + (this.width - iw) / 2, this.y, iw, ih)
    this.y += ih + 4
  }
}

export function buildReport(input: ReportInput): ReportOutput {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const hasFonts = !!input.fonts
  if (input.fonts) {
    doc.addFileToVFS('DejaVuSans.ttf', input.fonts.regular)
    doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal')
    doc.addFileToVFS('DejaVuSans-Bold.ttf', input.fonts.bold)
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold')
    doc.addFileToVFS('DejaVuSansMono.ttf', input.fonts.mono)
    doc.addFont('DejaVuSansMono.ttf', 'DejaVuMono', 'normal')
  }
  const w = new Writer(doc, hasFonts)
  const { result: r, net } = input
  const info = METHODS[r.method]
  const lbl = (id: string) => net.nodes.find((n) => n.id === id)?.label ?? id
  const date = input.generatedAt ?? new Date()
  // Without the Unicode font, fall back to ASCII-safe text.
  const t = (s: string) =>
    hasFonts
      ? s
      : s
          .replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)))
          .replace(/−/g, '-')
          .replace(/→/g, '->')
          .replace(/←/g, '<-')
          .replace(/Ω/g, 'Ohm')
          .replace(/µ/g, 'u')
          .replace(/[ₗ]/g, 'l')
          .replace(/[ₜ]/g, 't')
          .replace(/[ₙ]/g, 'n')
          .replace(/[ᵀ]/g, 'T')
          .replace(/Σ/g, 'Sum')
          .replace(/·/g, '*')
          .replace(/[⁰-⁹⁻]/g, (c) => ('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c) >= 0 ? String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)) : '-'))
  const fmt = (v: number, unit: string) => t(formatSI(v, unit, 4))

  /* ------------------------------ Title ------------------------------ */
  w.outline.push('Title')
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, PAGE.w, 34, 'F')
  w.font('bold', 20, [248, 250, 252])
  doc.text('NETTOPO', PAGE.m, 15)
  w.font('sans', 10.5, [186, 230, 253])
  doc.text(t('Network Topology & Circuit Analysis — Engineering Report'), PAGE.m, 22)
  w.font('sans', 9, [203, 213, 225])
  doc.text(t(`${input.projectName} · ${info.title} · ${date.toLocaleString()}`), PAGE.m, 28.5)
  w.y = 44

  w.section('Problem statement')
  w.para(t(input.problem || `Analyse the network of ${net.nodes.length} nodes and ${net.branches.length} branches by ${info.title} and determine every branch current, branch voltage and power.`))

  w.section('Circuit diagram', 70)
  if (input.circuitImage) w.image(input.circuitImage.dataUrl, input.circuitImage.width, input.circuitImage.height, 95)
  else w.para('(Circuit diagram unavailable in this environment.)')

  w.section('Network summary')
  const L = net.branches.length - net.nodes.length + 1
  w.kv([
    ['Nodes n', String(net.nodes.length)],
    ['Branches b', String(net.branches.length)],
    ['Connected', componentCount(net) === 1 ? 'yes' : 'no'],
    ['Twigs per tree (n − 1)', String(net.nodes.length - 1)],
    ['Links per tree (b − n + 1)', String(L)],
    ['Spanning trees det(A Aᵀ)', net.branches.length <= 16 ? String(countSpanningTrees(net)) : '—'],
  ].map(([k, v]) => [t(k), t(v)] as [string, string]))

  w.section('Node table')
  w.table(
    ['Node', 'Ground', 'Incident branches'],
    net.nodes.map((n) => [
      n.label,
      n.isGround ? 'yes' : '',
      net.branches
        .filter((b) => b.fromNode === n.id || b.toNode === n.id)
        .map((b) => b.label)
        .join(', '),
    ]),
    [30, 25, w.width - 55],
  )

  w.section('Branch table')
  w.table(
    ['Branch', 'From', 'To', 'Element', 'Current var.', 'Voltage var.'],
    net.branches.map((b) => [b.label, lbl(b.fromNode), lbl(b.toNode), b.elementLabel, t(`i${b.index}`), t(`v${b.index}`)]),
  )

  w.section('Element table')
  w.table(
    ['Element', 'Type', 'Value', 'Polarity s', 'Branch relation'],
    net.branches.map((b) => [
      b.elementLabel,
      ELEMENT_DESCRIPTORS[b.element.type].name,
      t(formatValue(b.element.value, ELEMENT_DESCRIPTORS[b.element.type].unit)),
      b.element.type === 'resistor' ? '—' : b.polarity > 0 ? '+1' : '−1',
      t(b.element.type === 'resistor' ? `v${b.index} = R·i${b.index}` : b.element.type === 'voltageSource' ? `v${b.index} = s·E` : `i${b.index} = s·I`),
    ]),
    [24, 40, 30, 22, w.width - 116],
  )

  w.section('Reference node')
  w.para(
    t(
      r.referenceNodeId
        ? `Reference node: ${lbl(r.referenceNodeId)}. Its row is removed from Aₐ to form A, and node voltages are measured from it.`
        : `${info.title} does not use a reference node. Node potentials shown in this report are derived from the branch voltages with respect to ${lbl(r.potentialReferenceNodeId)}.`,
    ),
  )

  w.section('Selected method')
  w.para(t(`${info.title} (${info.section}). ${info.description}`))

  w.section('Tree')
  if (r.tree) {
    w.para(t(`A valid spanning tree was selected: ${r.tree.tree.twigIds.length} twigs, connected, no cycle.`))
  } else w.para(t(`No tree is needed for ${info.title} (lazy analysis: tree structures were not computed).`))
  w.section('Twigs')
  w.para(r.tree ? r.tree.tree.twigIds.map((id) => net.branches.find((b) => b.id === id)!.label).join(', ') : '—', { mono: true })
  w.section('Links')
  w.para(r.tree ? r.tree.tree.linkIds.map((id) => net.branches.find((b) => b.id === id)!.label).join(', ') || 'none' : '—', { mono: true })
  if (r.tree?.fundamentalCircuits) {
    w.sub('Fundamental circuits')
    for (const c of r.tree.fundamentalCircuits)
      w.para(t(`link ${net.branches.find((b) => b.id === c.linkId)!.label}: ${c.branchOrder.map((id) => `${c.entries[id] > 0 ? '+' : '−'}${net.branches.find((b) => b.id === id)!.label}`).join(' ')}`), { mono: true, size: 8.5 })
  }
  if (r.tree?.fundamentalCutSets) {
    w.sub('Fundamental cut-sets')
    for (const c of r.tree.fundamentalCutSets)
      w.para(
        t(`twig ${net.branches.find((b) => b.id === c.twigId)!.label}: ${Object.entries(c.entries).map(([id, e]) => `${e > 0 ? '+' : '−'}${net.branches.find((b) => b.id === id)!.label}`).join(' ')}`),
        { mono: true, size: 8.5 },
      )
  }

  w.section('Matrices')
  for (const m of r.matrices) {
    w.sub(t(`${m.title} — ${plainSymbol(m.symbol)} (${m.rows.length}×${m.cols.length})`))
    w.matrix(m)
  }

  w.section('Equations')
  for (const g of r.equationGroups) {
    w.sub(t(g.title))
    for (const [k, eq] of g.equations.entries()) w.para(t(`(${k + 1})  ${equationText(eq.lhs, eq.rhs, (x) => formatNumber(x, 4))}`), { mono: true, size: 8.5, indent: 2 })
  }

  w.section('Step-by-step calculation')
  for (const s of r.steps) {
    w.para(t(`Step ${s.number} — ${s.title}`), { size: 9.5, color: [15, 23, 42] })
    w.para(t(s.summary), { size: 8.5, indent: 4, color: [51, 65, 85] })
    if (s.why) w.para(t(`Why? ${s.why}`), { size: 8, indent: 4, color: [100, 116, 139] })
  }

  w.section('Node voltages')
  w.table(
    ['Node', `Voltage w.r.t. ${lbl(r.potentialReferenceNodeId)}`, 'Source'],
    net.nodes.map((n) => [n.label, fmt(r.nodeVoltages[n.id] - r.nodeVoltages[r.potentialReferenceNodeId], 'V'), r.nodeVoltagesDerived ? 'derived from branch voltages' : 'solved'] as string[]),
    [30, 60, w.width - 90],
  )

  w.section('Branch currents')
  w.table(
    ['Branch', 'Element', 'iₖ (reference direction)', 'Actual direction'].map(t),
    r.branches.map((q) => {
      const b = net.branches.find((x) => x.id === q.branchId)!
      return [b.label, b.elementLabel, fmt(q.current, 'A'), t(q.current === 0 ? '—' : q.current > 0 ? `${lbl(b.fromNode)} → ${lbl(b.toNode)}` : `${lbl(b.toNode)} → ${lbl(b.fromNode)}`)]
    }),
  )

  w.section('Branch voltages')
  w.table(
    ['Branch', 'Element', 'vₖ', '+ terminal'].map(t),
    r.branches.map((q) => {
      const b = net.branches.find((x) => x.id === q.branchId)!
      return [b.label, b.elementLabel, fmt(q.voltage, 'V'), lbl(b.fromNode)]
    }),
  )

  w.section('Power')
  w.table(
    ['Branch', 'Element', 'pₖ = vₖiₖ', 'Absorbed / delivered'].map(t),
    r.branches.map((q) => {
      const b = net.branches.find((x) => x.id === q.branchId)!
      return [b.label, b.elementLabel, fmt(q.power, 'W'), q.power > 0 ? `absorbs ${fmt(q.power, 'W')}` : q.power < 0 ? `delivers ${fmt(-q.power, 'W')}` : '—']
    }),
  )

  w.section('Verification')
  w.table(
    ['Check', 'Status', 'Residual', 'Detail'],
    r.verification.checks.map((c) => [t(c.title), c.status.toUpperCase(), t(formatResidual(c.residual)), t(c.detail)]),
    [42, 20, 30, w.width - 92],
  )

  w.section('Tellegen')
  const tel = r.verification.checks.find((c) => c.id === 'tellegen')
  const sum = r.branches.reduce((s, q) => s + q.voltage * q.current, 0)
  w.para(t(`Σ vₖ iₖ over all ${net.branches.length} branches, computed from the solved voltages and currents = ${formatNumber(sum, 6)} W (|residual| ${formatResidual(Math.abs(sum))}). Status: ${tel?.status.toUpperCase() ?? '—'}.`))
  w.para(t(r.branches.map((q) => `${net.branches.find((b) => b.id === q.branchId)!.label}: ${formatNumber(q.voltage * q.current, 5)}`).join('   ')), { mono: true, size: 8 })

  w.section('Final circuit', 80)
  if (input.finalCircuitImage) w.image(input.finalCircuitImage.dataUrl, input.finalCircuitImage.width, input.finalCircuitImage.height, 110)
  else w.para('(Final circuit diagram unavailable in this environment.)')

  w.section('Oscilloscope', 75)
  if (input.scopeImage) {
    w.image(input.scopeImage.dataUrl, input.scopeImage.width, input.scopeImage.height, 70)
    w.para(t(input.scopeImage.caption), { size: 8.5 })
  } else w.para('(Oscilloscope capture unavailable in this environment.)')

  w.section('Conclusion')
  const delivered = -r.branches.filter((q) => q.power < 0).reduce((s, q) => s + q.power, 0)
  const absorbed = r.branches.filter((q) => q.power > 0).reduce((s, q) => s + q.power, 0)
  const fails = r.verification.checks.filter((c) => c.status === 'fail')
  w.para(
    t(
      `The network (n = ${net.nodes.length}, b = ${net.branches.length}) was solved by ${info.title} as a ${r.solver.size}×${r.solver.size} linear system with residual ${formatResidual(r.solver.residual)}. ` +
        `Sources deliver ${formatSI(delivered, 'W', 4)} and the network absorbs ${formatSI(absorbed, 'W', 4)}. ` +
        (fails.length === 0
          ? 'KCL, KVL, the element relations and Tellegen’s theorem are satisfied within tolerance, which confirms the solution.'
          : `The following checks FAILED: ${fails.map((f) => f.title).join(', ')}. The results should not be trusted.`),
    ),
  )

  // Footer with page numbers
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    w.font('sans', 7.5, [148, 163, 184])
    doc.text(t(`NETTOPO report · ${input.projectName}`), PAGE.m, PAGE.h - 8)
    doc.text(`${p} / ${pages}`, PAGE.w - PAGE.m, PAGE.h - 8, { align: 'right' })
  }
  return { doc, outline: w.outline }
}
