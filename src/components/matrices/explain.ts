import type { AnalysisResult } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import type { LabeledMatrix, MatrixAxisEntry } from '@/domain/topology/types'
import { formatNumber } from '@/engine/numerical'
import { explainCutSetEntry, explainFundamentalCircuitEntry, explainIncidenceEntry } from '@/engine/topology'

/** Highlight token for a matrix axis entry (b<k>, n<j>, l<k>, t<k>). */
export function axisToken(net: Network, e: MatrixAxisEntry): string | null {
  if (!e.refId) return null
  switch (e.kind) {
    case 'branch': {
      const b = net.branches.find((x) => x.id === e.refId)
      return b ? `b${b.index}` : null
    }
    case 'node': {
      const i = net.nodes.findIndex((x) => x.id === e.refId)
      return i >= 0 ? `n${i + 1}` : null
    }
    case 'fcircuit': {
      const b = net.branches.find((x) => x.id === e.refId)
      return b ? `l${b.index}` : null
    }
    case 'fcutset': {
      const b = net.branches.find((x) => x.id === e.refId)
      return b ? `t${b.index}` : null
    }
    default:
      return /^[bnlt]\d+$/.test(e.refId) ? e.refId : null
  }
}

/** "Why is this entry x?" for a matrix cell. */
export function explainEntry(m: LabeledMatrix, r: number, c: number, net: Network, result: AnalysisResult | null): string {
  const row = m.rows[r]
  const col = m.cols[c]
  const val = m.data[r]?.[c] ?? 0
  const v = formatNumber(val)
  switch (m.kind) {
    case 'incidence':
    case 'all-incidence':
      return explainIncidenceEntry(net, row.refId!, col.refId!)
    case 'fcircuit': {
      const fc = result?.tree?.fundamentalCircuits?.find((x) => x.linkId === row.refId)
      return fc ? explainFundamentalCircuitEntry(net, fc, col.refId!) : `${v}`
    }
    case 'fcutset': {
      const cs = result?.tree?.fundamentalCutSets?.find((x) => x.twigId === row.refId)
      return cs ? explainCutSetEntry(net, cs, col.refId!) : `${v}`
    }
    case 'branch-admittance':
    case 'branch-impedance': {
      if (r !== c) return '0: the branch matrix is diagonal because there are no mutual couplings or dependent sources between branches.'
      const b = net.branches.find((x) => x.id === row.refId)!
      if (b.element.type !== 'resistor') return `0: ${b.elementLabel} is an ideal source; it has no finite ${m.kind === 'branch-admittance' ? 'admittance' : 'impedance'} and is handled by augmentation.`
      return m.kind === 'branch-admittance' ? `${v} S = 1 / ${formatNumber(b.element.value)} Ω (${b.elementLabel}).` : `${v} Ω = resistance of ${b.elementLabel}.`
    }
    case 'node-admittance':
    case 'loop-impedance':
    case 'node-pair-admittance': {
      const what = m.kind === 'loop-impedance' ? 'impedances' : 'admittances'
      const where = m.kind === 'node-admittance' ? 'node' : m.kind === 'loop-impedance' ? 'f-circuit' : 'f-cut-set'
      if (r === c) return `${v}: sum of the ${what} of all branches in ${where} ${row.label} (diagonal entry).`
      return `${v}: ${m.kind === 'node-admittance' ? 'minus the sum' : '± the sum'} of the ${what} of branches common to ${where}s ${row.label} and ${m.rows[c]?.label ?? col.label}${m.kind === 'node-admittance' ? '' : ' (+ if both orient the branch the same way)'}.`
    }
    case 'system': {
      if (col.kind === 'rhs') return `${v}: right-hand side of equation ${row.label} (known source terms).`
      if (val === 0) return `0: unknown ${col.label} does not appear in equation ${row.label}.`
      const eq = result?.equationGroups.flatMap((g) => g.equations).find((e) => `eq:${e.id}` === row.id)
      return `${v}: coefficient of ${col.label} in equation ${row.label}${eq ? ` — ${eq.origin}` : ''}.`
    }
    default:
      return v
  }
}
