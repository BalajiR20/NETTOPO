import { describe, expect, it } from 'vitest'
import { matVec, multiply, solveLinearSystem, transpose } from '@/engine/numerical'
import { runAnalysis } from '@/engine/solvers'
import { suggestSpanningTree } from '@/engine/topology'
import { bridge, example17_4_1, example17_7_1 } from '@/tests/fixtures/textbook'
import { branchIds, br, expectOk, netFrom, nodeId } from '@/tests/helpers'

/**
 * The A, Bf and Qf methods must follow the textbook's partitioned procedure:
 *   Yn = Ap Yp Apᵀ,  Vn = −Yn⁻¹ Ag Ig        (§17.4)
 *   Z_L = Bfp Zp Bfpᵀ, Il = −Z_L⁻¹ Bfg Vg    (§17.7)
 *   Yt = Qfp Yp Qfpᵀ,  Vt = −Yt⁻¹ Qfg Ig     (§17.10)
 * Expected values below are computed here, independently, from the partitions
 * the solver reports, and (for the textbook examples) compared with the book.
 */
const mat = (r: { matrices: { id: string; data: number[][] }[] }, id: string) => r.matrices.find((m) => m.id === id)!.data
const has = (r: { matrices: { id: string }[] }, id: string) => r.matrices.some((m) => m.id === id)
const negSolve = (K: number[][], rhsMat: number[][], g: number[]) => {
  const rhs = matVec(rhsMat, g).map((x) => -x)
  const s = solveLinearSystem(K, rhs)
  if (!s.ok) throw new Error('singular')
  return s.x
}

describe('A method follows §17.4 (Example 17.4-1)', () => {
  const net = netFrom(example17_4_1)
  const r = expectOk(runAnalysis('incidence', net, { referenceNodeId: nodeId(net, 'R') }))

  it('partitions A = [Ap Ag] with the book\'s Ap (3×6) and Ag (3×3)', () => {
    expect(mat(r, 'Ap')).toHaveLength(3)
    expect(mat(r, 'Ap')[0]).toHaveLength(6)
    expect(mat(r, 'Ag')[0]).toHaveLength(3)
    expect(has(r, 'Av')).toBe(false)
  })

  it('Yp is the 6×6 passive admittance matrix and Yn = Ap Yp Apᵀ = [[8,−1,−2],[−1,4,−2],[−2,−2,9]]', () => {
    expect(mat(r, 'Yp')).toHaveLength(6)
    expect(mat(r, 'Yn')).toEqual([
      [8, -1, -2],
      [-1, 4, -2],
      [-2, -2, 9],
    ])
    const Ap = mat(r, 'Ap')
    const again = multiply(multiply(Ap, mat(r, 'Yp')), transpose(Ap))
    expect(mat(r, 'Yn')).toEqual(again)
  })

  it('Vn = −Yn⁻¹ Ag Ig = [2, 1, 3] V, solved from the book\'s system with no augmentation', () => {
    const ig = ['I1', 'I2', 'I3'].map((l) => r.branchCurrents[br(net, l).id])
    expect(ig.map((x) => Math.abs(x))).toEqual([9, 17, 21])
    const expected = negSolve(mat(r, 'Yn'), mat(r, 'Ag'), ig)
    r.primary.forEach((p, k) => expect(p.value).toBeCloseTo(expected[k], 12))
    expect(r.primary.map((p) => p.value)).toEqual([2, 1, 3].map((x) => expect.closeTo(x, 10)))
    expect(has(r, 'M')).toBe(false)
  })

  it('needs no tree', () => {
    expect(r.tree).toBeNull()
    expect(has(r, 'Bf')).toBe(false)
    expect(has(r, 'Qf')).toBe(false)
  })

  it('lists the book\'s steps in order', () => {
    const ids = r.steps.map((s) => s.id)
    const order = ['reference', 'matrix', 'partition', 'laws', 'branch-relation', 'core', 'sources', 'equations', 'solve', 'recover']
    expect(order.map((id) => ids.indexOf(id))).toEqual([...order.map((id) => ids.indexOf(id))].sort((a, b) => a - b))
    order.forEach((id) => expect(ids).toContain(id))
  })
})

describe('Bf method follows §17.7 (Example 17.7-1)', () => {
  const net = netFrom(example17_7_1)
  const twigs = branchIds(net, ['V1', 'V2', 'V3', 'V4', 'R2', 'R4'])
  const r = expectOk(runAnalysis('fcircuit', net, { treeBranchIds: twigs }))

  it('partitions Bf = [Bfg Bfp] and forms Z_L = Bfp Zp Bfpᵀ = the book\'s matrix', () => {
    expect(mat(r, 'Bfg')[0]).toHaveLength(4)
    expect(mat(r, 'Bfp')[0]).toHaveLength(5)
    expect(has(r, 'Bfi')).toBe(false)
    expect(mat(r, 'ZL')).toEqual([
      [5, -3, 0],
      [-3, 5, -1],
      [0, -1, 5],
    ])
    const Bfp = mat(r, 'Bfp')
    expect(mat(r, 'ZL')).toEqual(multiply(multiply(Bfp, mat(r, 'Zp')), transpose(Bfp)))
  })

  it('Il = −Z_L⁻¹ Bfg Vg = [1, 2, 3] A and the source currents are [−1, −1, −1, 3] A', () => {
    const vg = ['V1', 'V2', 'V3', 'V4'].map((l) => r.branchVoltages[br(net, l).id])
    const expected = negSolve(mat(r, 'ZL'), mat(r, 'Bfg'), vg)
    r.primary.forEach((p, k) => expect(p.value).toBeCloseTo(expected[k], 12))
    expect(r.primary.map((p) => p.value)).toEqual([1, 2, 3].map((x) => expect.closeTo(x, 10)))
    ;['V1', 'V2', 'V3', 'V4'].forEach((l, k) => expect(r.branchCurrents[br(net, l).id]).toBeCloseTo([-1, -1, -1, 3][k], 10))
    expect(has(r, 'M')).toBe(false)
  })

  it('does not build A or Qf', () => {
    expect(has(r, 'A')).toBe(false)
    expect(has(r, 'Qf')).toBe(false)
    expect(r.tree?.fundamentalCircuits?.length).toBe(3)
  })
})

describe('Qf method follows §17.10', () => {
  const net = netFrom(example17_4_1)
  const tree = suggestSpanningTree(net)!.twigIds
  const r = expectOk(runAnalysis('fcutset', net, { treeBranchIds: tree }))

  it('Yt = Qfp Yp Qfpᵀ and Vt = −Yt⁻¹ Qfg Ig, solved from the book\'s system', () => {
    const Qfp = mat(r, 'Qfp')
    expect(mat(r, 'Yt')).toEqual(multiply(multiply(Qfp, mat(r, 'Yp')), transpose(Qfp)))
    const ig = ['I1', 'I2', 'I3'].map((l) => r.branchCurrents[br(net, l).id])
    const expected = negSolve(mat(r, 'Yt'), mat(r, 'Qfg'), ig)
    r.primary.forEach((p, k) => expect(p.value).toBeCloseTo(expected[k], 10))
    expect(has(r, 'M')).toBe(false)
    expect(r.tree?.fundamentalCutSets?.length).toBe(3)
  })

  it('does not build A or Bf', () => {
    expect(has(r, 'A')).toBe(false)
    expect(has(r, 'Bf')).toBe(false)
  })
})

describe('mixed sources: the augmentation partition keeps the book equation intact', () => {
  const net = netFrom(bridge)
  const tree = suggestSpanningTree(net)!.twigIds
  const ref = { referenceNodeId: nodeId(net, 'g'), treeBranchIds: tree }
  const base = expectOk(runAnalysis('nodal', net, ref))

  it.each(['incidence', 'fcircuit', 'fcutset'] as const)('%s agrees with nodal analysis and passes verification', (m) => {
    const r = expectOk(runAnalysis(m, net, ref))
    for (const b of net.branches) {
      expect(r.branchCurrents[b.id]).toBeCloseTo(base.branchCurrents[b.id], 9)
      expect(r.branchVoltages[b.id]).toBeCloseTo(base.branchVoltages[b.id], 9)
    }
    expect(r.verification.overall).toBe('pass')
    // the book's matrix product is untouched by the augmentation block
    const core = { incidence: 'Yn', fcircuit: 'ZL', fcutset: 'Yt' }[m]
    const Tp = { incidence: 'Ap', fcircuit: 'Bfp', fcutset: 'Qfp' }[m]
    const D = m === 'fcircuit' ? 'Zp' : 'Yp'
    expect(mat(r, core)).toEqual(multiply(multiply(mat(r, Tp), mat(r, D)), transpose(mat(r, Tp))))
  })
})
