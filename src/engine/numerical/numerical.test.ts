import { describe, expect, it } from 'vitest'
import { cleanZero, eliminate, formatNumber, formatResidual, formatSI, latexNumber, rank, solveLinearSystem } from '@/engine/numerical'

describe('numerical engine', () => {
  it('solves a well-conditioned system with tiny residual', () => {
    const r = solveLinearSystem(
      [
        [8, -1, -2],
        [-1, 4, -2],
        [-2, -2, 9],
      ],
      [9, -4, 21],
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.x).toEqual([2, 1, 3].map((x) => expect.closeTo(x, 12)))
      expect(r.residual).toBeLessThan(1e-12)
      expect(r.conditionEstimate).toBeGreaterThan(1)
    }
  })

  it('reports singular systems with the undetermined unknowns, never NaN', () => {
    const r = solveLinearSystem(
      [
        [1, 1],
        [2, 2],
      ],
      [1, 2],
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('singular')
      expect(r.rank).toBe(1)
      expect(r.freeColumns).toEqual([1])
    }
  })

  it('rejects non-finite coefficients', () => {
    const r = solveLinearSystem([[Number.POSITIVE_INFINITY]], [1])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid')
  })

  it('warns on ill-conditioned systems', () => {
    const e = 1e-14
    const r = solveLinearSystem(
      [
        [1, 1],
        [1, 1 + e],
      ],
      [2, 2 + e],
    )
    if (r.ok) expect(r.warnings.join(' ')).toMatch(/ill-conditioned/)
    else expect(r.reason).toBe('singular')
  })

  it('handles the empty system', () => {
    const r = solveLinearSystem([], [])
    expect(r.ok && r.x).toEqual([])
  })

  it('rank and elimination', () => {
    expect(rank([[1, 2, 3], [2, 4, 6], [1, 0, 1]])).toBe(2)
    expect(eliminate([[0, 0], [0, 0]]).rank).toBe(0)
  })

  it('formats engineering values without NaN/undefined', () => {
    expect(formatSI(2.4, 'A')).toBe('2.40 A')
    expect(formatSI(-0.0024, 'A')).toBe('−2.40 mA')
    expect(formatSI(12, 'V')).toBe('12.0 V')
    expect(formatSI(4700, 'Ω')).toBe('4.70 kΩ')
    expect(formatSI(0, 'W')).toBe('0 W')
    expect(formatSI(Number.NaN, 'V')).toBe('undefined V')
    expect(formatNumber(-0.5)).toBe('−0.5')
    expect(formatNumber(1e-13)).toBe('0')
    expect(formatResidual(2.1e-12)).toBe('2.1 × 10⁻¹²')
    expect(latexNumber(-2.5e-7)).toBe('-2.5\\times 10^{-7}')
    expect(cleanZero(-0)).toBe(0)
    expect(Object.is(cleanZero(-1e-15), 0)).toBe(true)
  })
})
