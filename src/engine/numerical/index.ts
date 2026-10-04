import { det as mDet, inv as mInv, lusolve, multiply as mMultiply, norm as mNorm, transpose as mTranspose } from 'mathjs'

export type Matrix = number[][]
export type Vector = number[]

export const zeros = (r: number, c: number): Matrix => Array.from({ length: r }, () => new Array<number>(c).fill(0))
export const identity = (n: number): Matrix => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))

export function transpose(m: Matrix, cols?: number): Matrix {
  if (m.length === 0) return cols ? Array.from({ length: cols }, () => []) : []
  return mTranspose(m) as Matrix
}

/** Matrix product via math.js; handles empty dimensions explicitly (math.js does not). */
export function multiply(a: Matrix, b: Matrix, innerHint?: { aCols: number; bCols: number }): Matrix {
  const r = a.length
  const c = b[0]?.length ?? innerHint?.bCols ?? 0
  const inner = a[0]?.length ?? innerHint?.aCols ?? b.length
  if (r === 0 || c === 0) return zeros(r, c)
  if (inner === 0) return zeros(r, c)
  return mMultiply(a, b) as Matrix
}

export function matVec(m: Matrix, v: Vector): Vector {
  return m.map((row) => row.reduce((s, x, j) => s + x * (v[j] ?? 0), 0))
}

export const vecSub = (a: Vector, b: Vector): Vector => a.map((x, i) => x - b[i])
export const vecAdd = (a: Vector, b: Vector): Vector => a.map((x, i) => x + b[i])
export const maxAbs = (v: Vector): number => v.reduce((m, x) => Math.max(m, Math.abs(x)), 0)
export const maxAbsMatrix = (m: Matrix): number => m.reduce((mm, row) => Math.max(mm, maxAbs(row)), 0)

export function det(m: Matrix): number {
  if (m.length === 0) return 1
  return mDet(m) as number
}

/** Selects columns by index. */
export const pickColumns = (m: Matrix, idx: number[]): Matrix => m.map((row) => idx.map((j) => row[j]))
export const pickRows = (m: Matrix, idx: number[]): Matrix => idx.map((i) => m[i].slice())

export interface EliminationInfo {
  rank: number
  /** Column indices without a pivot (undetermined unknowns when singular). */
  freeColumns: number[]
  /** Row indices that reduced to zero (redundant or inconsistent equations). */
  zeroRows: number[]
}

/** Gaussian elimination with partial pivoting; numerically safe rank estimate. */
export function eliminate(m: Matrix, relTol = 1e-11): EliminationInfo {
  const a = m.map((r) => r.slice())
  const rows = a.length
  const cols = a[0]?.length ?? 0
  const scale = Math.max(maxAbsMatrix(a), 1e-300)
  const tol = relTol * scale * Math.max(rows, cols, 1)
  const pivotCols: number[] = []
  const rowUsed: boolean[] = new Array(rows).fill(false)
  let r = 0
  const rowOrder = Array.from({ length: rows }, (_, i) => i)
  for (let c = 0; c < cols && r < rows; c++) {
    let best = r
    for (let i = r + 1; i < rows; i++) if (Math.abs(a[i][c]) > Math.abs(a[best][c])) best = i
    if (Math.abs(a[best][c]) <= tol) continue
    ;[a[r], a[best]] = [a[best], a[r]]
    ;[rowOrder[r], rowOrder[best]] = [rowOrder[best], rowOrder[r]]
    for (let i = r + 1; i < rows; i++) {
      const f = a[i][c] / a[r][c]
      if (f === 0) continue
      for (let j = c; j < cols; j++) a[i][j] -= f * a[r][j]
    }
    pivotCols.push(c)
    rowUsed[rowOrder[r]] = true
    r++
  }
  const pivotSet = new Set(pivotCols)
  return {
    rank: pivotCols.length,
    freeColumns: Array.from({ length: cols }, (_, j) => j).filter((j) => !pivotSet.has(j)),
    zeroRows: rowOrder.slice(r),
  }
}

export const rank = (m: Matrix) => (m.length === 0 ? 0 : eliminate(m).rank)

export type SolveFailureReason = 'invalid' | 'singular' | 'dimension'

export interface SolveSuccess {
  ok: true
  x: Vector
  residual: number
  conditionEstimate: number | null
  rank: number
  warnings: string[]
}

export interface SolveFailure {
  ok: false
  reason: SolveFailureReason
  message: string
  rank: number
  freeColumns: number[]
}

/**
 * Solves M x = r with math.js (LU with partial pivoting) after a rank check.
 * Never returns NaN/Infinity: those cases become an explained failure.
 */
export function solveLinearSystem(M: Matrix, r: Vector): SolveSuccess | SolveFailure {
  const n = M.length
  if (n === 0) return { ok: true, x: [], residual: 0, conditionEstimate: 1, rank: 0, warnings: [] }
  if (M.some((row) => row.length !== n) || r.length !== n) {
    return { ok: false, reason: 'dimension', message: `System is not square (${n} equations, ${M[0]?.length ?? 0} unknowns).`, rank: 0, freeColumns: [] }
  }
  if (M.some((row) => row.some((x) => !Number.isFinite(x))) || r.some((x) => !Number.isFinite(x))) {
    return { ok: false, reason: 'invalid', message: 'The system contains a non-finite coefficient (check element values).', rank: 0, freeColumns: [] }
  }
  const info = eliminate(M)
  if (info.rank < n) {
    return {
      ok: false,
      reason: 'singular',
      message: `The system matrix is singular (rank ${info.rank} < ${n}).`,
      rank: info.rank,
      freeColumns: info.freeColumns,
    }
  }
  const warnings: string[] = []
  let x: Vector
  try {
    const sol = lusolve(M, r) as Matrix
    x = sol.map((row) => row[0])
  } catch (e) {
    return { ok: false, reason: 'singular', message: `LU factorisation failed: ${(e as Error).message}`, rank: info.rank, freeColumns: [] }
  }
  if (x.some((v) => !Number.isFinite(v))) {
    return { ok: false, reason: 'singular', message: 'The solution contains non-finite values; the system is numerically singular.', rank: info.rank, freeColumns: [] }
  }
  let conditionEstimate: number | null = null
  if (n <= 120) {
    try {
      const Minv = mInv(M) as Matrix
      conditionEstimate = (mNorm(M, 1) as number) * (mNorm(Minv, 1) as number)
    } catch {
      conditionEstimate = null
    }
  }
  if (conditionEstimate !== null && conditionEstimate > 1e12) {
    warnings.push(`The system is ill-conditioned (κ₁ ≈ ${conditionEstimate.toExponential(2)}); results may lose accuracy.`)
  }
  const res = vecSub(matVec(M, x), r)
  return { ok: true, x: x.map(cleanZero), residual: maxAbs(res), conditionEstimate, rank: info.rank, warnings }
}

/** Removes −0 and sub-femto noise relative to a scale. */
export function cleanZero(v: number, scale = 1): number {
  if (!Number.isFinite(v)) return v
  return Math.abs(v) < 1e-12 * Math.max(1, Math.abs(scale)) ? 0 : v
}

/* ------------------------------ formatting ------------------------------ */

const SI: [number, string][] = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
]

/** Plain number with `sig` significant digits; trims trailing zeros. */
export function formatNumber(v: number, sig = 4): string {
  if (Number.isNaN(v)) return 'undefined (NaN)'
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞'
  if (v === 0 || Math.abs(v) < 1e-12) return '0'
  const a = Math.abs(v)
  if (a >= 1e6 || a < 1e-4) return v.toExponential(sig - 1).replace(/\.?0+e/, 'e').replace(/-/g, '−')
  const s = Number(v.toPrecision(sig)).toString()
  return s.replace(/-/g, '−')
}

/** Engineering format with SI prefix: 2.40 A, 12.0 V, 4.7 kΩ. */
export function formatSI(v: number, unit: string, sig = 3): string {
  if (Number.isNaN(v)) return `undefined ${unit}`
  if (!Number.isFinite(v)) return `${v > 0 ? '∞' : '−∞'} ${unit}`
  if (v === 0 || Math.abs(v) < 1e-15) return `0 ${unit}`
  v = Number(v.toPrecision(sig))
  const a = Math.abs(v)
  const [f, p] = SI.find(([f]) => a >= f) ?? SI[SI.length - 1]
  const scaled = v / f
  const digits = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(scaled))))
  return `${scaled.toFixed(Math.min(digits, 6)).replace('-', '−')} ${p}${unit}`
}

/** Component value with SI prefix and trailing zeros trimmed: 2 Ω, 4.7 kΩ, 0.5 Ω, −17 A. */
export function formatValue(v: number, unit: string, sig = 4): string {
  if (!Number.isFinite(v)) return formatSI(v, unit)
  if (v === 0) return `0 ${unit}`
  const a = Math.abs(v)
  const [f, p] = SI.find(([f]) => a >= f) ?? SI[SI.length - 1]
  const scaled = Number((v / f).toPrecision(sig))
  return `${String(scaled).replace(/-/g, '−')} ${p}${unit}`
}

/** Residual formatting: 2.1 × 10⁻¹² */
export function formatResidual(v: number | null): string {
  if (v === null) return '—'
  if (v === 0) return '0'
  if (!Number.isFinite(v)) return 'non-finite'
  const exp = Math.floor(Math.log10(Math.abs(v)))
  const mant = v / 10 ** exp
  const sup = String(exp)
    .split('')
    .map((ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(ch)] ?? (ch === '-' ? '⁻' : ch))
    .join('')
  return `${mant.toFixed(1)} × 10${sup}`
}

/** Coefficient → LaTeX (integers stay integers, others 4 significant digits). */
export function latexNumber(v: number, sig = 4): string {
  const s = formatNumber(v, sig).replace(/−/g, '-')
  if (s.includes('e')) {
    const [m, e] = s.split('e')
    return `${m}\\times 10^{${Number(e)}}`
  }
  return s
}
