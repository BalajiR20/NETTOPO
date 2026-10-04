import type { Term, VarRef } from '@/domain/analysis/types'
import type { Branch, Network, NodeId } from '@/domain/network/types'
import { latexNumber } from '@/engine/numerical'

/**
 * Generalised branch model (§17.11, Fig. 17.11-1):
 *   vₖ = v_pk − v_gk,  iₖ = i_pk − i_gk,  v_pk = zₖ i_pk
 *
 * Ideal sources cannot be expressed with a finite non-zero z or y; they are
 * flagged (`idealV` / `idealI`) and handled by augmentation in the solvers.
 */
export interface BranchModel {
  branch: Branch
  /** Column index in natural branch order. */
  col: number
  kind: Branch['element']['type']
  /** Series impedance (Ω); 0 for ideal voltage sources; null for ideal current sources. */
  z: number | null
  /** Admittance (S); 0 for ideal current sources; null for ideal voltage sources. */
  y: number | null
  /** Series source voltage v_gk of the generalised branch. */
  vg: number
  /** Parallel source current i_gk of the generalised branch. */
  ig: number
  idealV: boolean
  idealI: boolean
  /** Known branch voltage (ideal V-source): vₖ = s·E. */
  knownV: number | null
  /** Known branch current (ideal I-source): iₖ = s·I. */
  knownI: number | null
}

export function branchModels(net: Network): BranchModel[] {
  return net.branches.map((b, col) => {
    const s = b.polarity
    const val = b.element.value
    switch (b.element.type) {
      case 'resistor':
        return { branch: b, col, kind: 'resistor', z: val, y: 1 / val, vg: 0, ig: 0, idealV: false, idealI: false, knownV: null, knownI: null }
      case 'voltageSource':
        return { branch: b, col, kind: 'voltageSource', z: 0, y: null, vg: -s * val, ig: 0, idealV: true, idealI: false, knownV: s * val, knownI: null }
      case 'currentSource':
        return { branch: b, col, kind: 'currentSource', z: null, y: 0, vg: 0, ig: -s * val, idealV: false, idealI: true, knownV: null, knownI: s * val }
    }
  })
}

/* ------------------------------ variables ------------------------------ */

/** Compact ref tokens safe inside KaTeX \htmlData: b<k> branch, n<j> node, l<k> loop (link), t<k> twig. */
export const refToken = {
  branch: (b: Branch) => `b${b.index}`,
  node: (net: Network, id: NodeId) => `n${net.nodes.findIndex((n) => n.id === id) + 1}`,
  loop: (b: Branch) => `l${b.index}`,
  twig: (b: Branch) => `t${b.index}`,
}

export const varI = (b: Branch): VarRef => ({ kind: 'i', id: b.id, latex: `i_{${b.index}}`, text: `i${b.index}`, unit: 'A' })
export const varV = (b: Branch): VarRef => ({ kind: 'v', id: b.id, latex: `v_{${b.index}}`, text: `v${b.index}`, unit: 'V' })
export const varVn = (net: Network, id: NodeId): VarRef => {
  const n = net.nodes.find((x) => x.id === id)!
  const safe = n.label.replace(/[^A-Za-z0-9]/g, '') || String(net.nodes.indexOf(n) + 1)
  return { kind: 'vn', id, latex: `v_{n,\\mathrm{${safe}}}`, text: `vn(${n.label})`, unit: 'V' }
}
export const varIl = (b: Branch): VarRef => ({ kind: 'il', id: b.id, latex: `i_{l${b.index}}`, text: `il${b.index}`, unit: 'A' })
export const varVt = (b: Branch): VarRef => ({ kind: 'vt', id: b.id, latex: `v_{t${b.index}}`, text: `vt${b.index}`, unit: 'V' })
/** Augmented unknowns: current through an ideal V-source / voltage across an ideal I-source. */
export const varXi = (b: Branch): VarRef => ({ ...varI(b), kind: 'xi' })
export const varXv = (b: Branch): VarRef => ({ ...varV(b), kind: 'xv' })

/** Ref token for a variable (what gets highlighted on click). */
export function varToken(net: Network, v: VarRef): string {
  const b = net.branches.find((x) => x.id === v.id)
  switch (v.kind) {
    case 'vn':
      return refToken.node(net, v.id)
    case 'il':
      return b ? refToken.loop(b) : ''
    case 'vt':
      return b ? refToken.twig(b) : ''
    default:
      return b ? refToken.branch(b) : ''
  }
}

export const htmlVar = (net: Network, v: VarRef) => `\\htmlData{ref=${varToken(net, v)}}{${v.latex}}`

/* ------------------------------ LaTeX ------------------------------ */

export function termsLatex(net: Network, terms: Term[], interactive = true): string {
  const parts: string[] = []
  for (const t of terms) {
    if (t.coef === 0) continue
    const sym = interactive ? htmlVar(net, t.v) : t.v.latex
    const mag = Math.abs(t.coef)
    const coef = mag === 1 ? '' : `${latexNumber(mag)}\\,`
    const sign = t.coef < 0 ? '-' : '+'
    if (parts.length === 0) parts.push(`${t.coef < 0 ? '-' : ''}${coef}${sym}`)
    else parts.push(` ${sign} ${coef}${sym}`)
  }
  return parts.length ? parts.join('') : '0'
}

export function equationLatex(net: Network, lhs: Term[], rhs: number | string): string {
  return `${termsLatex(net, lhs)} = ${typeof rhs === 'number' ? latexNumber(rhs) : rhs}`
}

/** Plain-text rendering (used by the PDF report): i₁ + i₂ − i₃ = 0 */
const SUB = '₀₁₂₃₄₅₆₇₈₉'
export const subscript = (n: number | string) =>
  String(n)
    .split('')
    .map((c) => (c >= '0' && c <= '9' ? SUB[Number(c)] : c))
    .join('')

export function varText(v: VarRef): string {
  const m = v.text.match(/^([a-z]+)(\d+)$/)
  if (m) {
    const [, base, k] = m
    if (base === 'il') return `iₗ${subscript(k)}`
    if (base === 'vt') return `vₜ${subscript(k)}`
    return `${base}${subscript(k)}`
  }
  return v.text
}

export function equationText(lhs: Term[], rhs: number, fmt: (x: number) => string): string {
  const parts: string[] = []
  for (const t of lhs) {
    if (t.coef === 0) continue
    const mag = Math.abs(t.coef)
    const coef = mag === 1 ? '' : `${fmt(mag)}·`
    if (parts.length === 0) parts.push(`${t.coef < 0 ? '−' : ''}${coef}${varText(t.v)}`)
    else parts.push(` ${t.coef < 0 ? '−' : '+'} ${coef}${varText(t.v)}`)
  }
  return `${parts.length ? parts.join('') : '0'} = ${fmt(rhs)}`
}

/** Matrix → LaTeX bmatrix. */
export function matrixLatex(data: number[][]): string {
  if (data.length === 0) return '\\left[\\;\\right]'
  return `\\begin{bmatrix}${data.map((r) => r.map((x) => latexNumber(x)).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`
}

export const vectorLatex = (vals: string[]) => `\\begin{bmatrix}${vals.join(' \\\\ ')}\\end{bmatrix}`
