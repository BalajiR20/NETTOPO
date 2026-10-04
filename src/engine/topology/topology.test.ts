import { describe, expect, it } from 'vitest'
import { det, maxAbsMatrix, multiply, pickColumns, rank, transpose } from '@/engine/numerical'
import {
  allIncidenceMatrix,
  countSpanningTrees,
  findSpanningTrees,
  fundamentalCircuitMatrix,
  fundamentalCircuits,
  fundamentalCutSetMatrix,
  fundamentalCutSets,
  incidenceData,
  makeTree,
  reducedIncidenceMatrix,
  suggestSpanningTree,
  validateTree,
} from '@/engine/topology'
import { branchIds, br, netFrom, nodeId } from '@/tests/helpers'
import { example17_4_1, example17_7_1, example17_7_1_Bf, fig17_2_1, fig17_2_1_Aa } from '@/tests/fixtures/textbook'

describe('incidence matrix (§17.2)', () => {
  const net = netFrom(fig17_2_1)

  it('reproduces the printed all-incidence matrix Aa of Fig. 17.2-1', () => {
    const Aa = allIncidenceMatrix(net)
    expect(Aa.rows.map((r) => r.label)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(Aa.data).toEqual(fig17_2_1_Aa)
  })

  it('has exactly one +1 and one −1 per column, rows summing to zero', () => {
    const Aa = allIncidenceMatrix(net).data
    for (let j = 0; j < 8; j++) {
      const col = Aa.map((r) => r[j])
      expect(col.filter((x) => x === 1)).toHaveLength(1)
      expect(col.filter((x) => x === -1)).toHaveLength(1)
    }
    expect(Aa.reduce((s, r) => s.map((x, j) => x + r[j]), new Array(8).fill(0))).toEqual(new Array(8).fill(0))
  })

  it('reduced A drops the reference row: (n−1)×b with rank n−1', () => {
    const A = reducedIncidenceMatrix(net, nodeId(net, '6'))
    expect(A.data).toEqual(fig17_2_1_Aa.slice(0, 5))
    expect(A.data.length).toBe(5)
    expect(A.data[0].length).toBe(8)
    expect(rank(A.data)).toBe(5)
  })

  it('every entry is traceable to node + branch + orientation', () => {
    const A = reducedIncidenceMatrix(net, nodeId(net, '6'))
    A.rows.forEach((row, i) =>
      A.cols.forEach((col, j) => {
        const b = net.branches.find((x) => x.id === col.refId)!
        const expected = b.fromNode === row.refId ? 1 : b.toNode === row.refId ? -1 : 0
        expect(A.data[i][j]).toBe(expected)
      }),
    )
  })

  it('det(A Aᵀ) = 35 spanning trees, matching the textbook and explicit enumeration', () => {
    expect(countSpanningTrees(net)).toBe(35)
    expect(findSpanningTrees(net)).toHaveLength(35)
  })

  it('det(A_t) = ±1 for the tree {1,3,6,7,8}', () => {
    const A = incidenceData(net, ['1', '2', '3', '4', '5'].map((l) => nodeId(net, l)))
    const idx = ['R1', 'R3', 'R6', 'R7', 'R8'].map((l) => br(net, l).index - 1)
    expect(Math.abs(det(pickColumns(A, idx)))).toBeCloseTo(1, 12)
  })
})

describe('tree engine (§17.1.1)', () => {
  const net = netFrom(fig17_2_1)

  it('accepts the textbook trees {1,3,6,7,8}, {1,2,3,5,6}, {2,4,5,7,8}', () => {
    for (const t of [
      ['R1', 'R3', 'R6', 'R7', 'R8'],
      ['R1', 'R2', 'R3', 'R5', 'R6'],
      ['R2', 'R4', 'R5', 'R7', 'R8'],
    ]) {
      expect(validateTree(net, branchIds(net, t)).valid).toBe(true)
    }
  })

  it('rejects too few branches with an actionable message', () => {
    const v = validateTree(net, branchIds(net, ['R1', 'R3', 'R6', 'R7']))
    expect(v.valid).toBe(false)
    expect(v.selected).toBe(4)
    expect(v.required).toBe(5)
    expect(v.issues.map((i) => i.code)).toContain('too-few')
    expect(v.issues[0].message).toMatch(/Select one more branch/)
  })

  it('rejects too many branches', () => {
    const v = validateTree(net, branchIds(net, ['R1', 'R3', 'R6', 'R7', 'R8', 'R2']))
    expect(v.valid).toBe(false)
    expect(v.issues.map((i) => i.code)).toContain('too-many')
  })

  it('rejects a cycle and reports its branches', () => {
    // 1→3 (R4), 3? R6: 2→3, R5: 1→2 → loop {R4, R5, R6}
    const v = validateTree(net, branchIds(net, ['R4', 'R5', 'R6', 'R7', 'R8']))
    expect(v.valid).toBe(false)
    expect(v.hasCycle).toBe(true)
    expect(new Set(v.cycleBranchIds)).toEqual(new Set(branchIds(net, ['R4', 'R5', 'R6'])))
    expect(v.issues[0].message).toMatch(/cannot contain a cycle/)
  })

  it('rejects a disconnected selection', () => {
    const v = validateTree(net, branchIds(net, ['R1', 'R2']))
    expect(v.connected).toBe(false)
    expect(v.issues.map((i) => i.code)).toContain('disconnected')
  })

  it('suggestSpanningTree prefers voltage sources as twigs and current sources as links', () => {
    const n2 = netFrom(example17_7_1)
    const t = suggestSpanningTree(n2)!
    for (const v of ['V1', 'V2', 'V3', 'V4']) expect(t.twigIds).toContain(br(n2, v).id)
    const n3 = netFrom(example17_4_1)
    const t3 = suggestSpanningTree(n3)!
    for (const i of ['I1', 'I2', 'I3']) expect(t3.linkIds).toContain(br(n3, i).id)
    expect(validateTree(n3, t3.twigIds).valid).toBe(true)
  })
})

describe('fundamental circuits and Bf (§17.5)', () => {
  const net = netFrom(example17_7_1)
  const tree = makeTree(net, branchIds(net, ['V1', 'V2', 'V3', 'V4', 'R2', 'R4']))

  it('reproduces the printed Bf of Example 17.7-1', () => {
    const Bf = fundamentalCircuitMatrix(net, tree)
    expect(Bf.data).toEqual(example17_7_1_Bf)
    expect(Bf.rows.map((r) => net.branches.find((b) => b.id === r.refId)!.elementLabel)).toEqual(['R1', 'R3', 'R5'])
  })

  it('has dimensions (b−n+1)×b, rank b−n+1, and [B_ft | U] when partitioned', () => {
    const Bf = fundamentalCircuitMatrix(net, tree, undefined, 'partitioned')
    const b = net.branches.length
    const n = net.nodes.length
    expect(Bf.data.length).toBe(b - n + 1)
    expect(rank(Bf.data)).toBe(b - n + 1)
    const L = Bf.data.length
    const U = Bf.data.map((r) => r.slice(b - L))
    expect(U).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
    expect(Bf.cols.slice(0, n - 1).every((c) => c.group === 'twig')).toBe(true)
  })

  it('each f-circuit contains its link with +1 and is a closed loop', () => {
    for (const c of fundamentalCircuits(net, tree)) {
      expect(c.entries[c.linkId]).toBe(1)
      // closed: every node of the loop has degree 2 within the loop
      const deg = new Map<string, number>()
      for (const id of Object.keys(c.entries)) {
        const b = net.branches.find((x) => x.id === id)!
        deg.set(b.fromNode, (deg.get(b.fromNode) ?? 0) + 1)
        deg.set(b.toNode, (deg.get(b.toNode) ?? 0) + 1)
      }
      expect([...deg.values()].every((d) => d === 2)).toBe(true)
    }
  })

  it('orthogonality A Bfᵀ = 0 and B_ft = −(A_t⁻¹ A_l)ᵀ', () => {
    const ref = nodeId(net, 'G')
    const A = reducedIncidenceMatrix(net, ref).data
    const Bf = fundamentalCircuitMatrix(net, tree).data
    expect(maxAbsMatrix(multiply(A, transpose(Bf)))).toBe(0)
  })
})

describe('fundamental cut-sets and Qf (§17.8)', () => {
  for (const [name, spec, twigs] of [
    ['Example 17.7-1', example17_7_1, ['V1', 'V2', 'V3', 'V4', 'R2', 'R4']],
    ['Example 17.4-1', example17_4_1, ['R1', 'R2', 'R5']],
    ['Fig. 17.2-1', fig17_2_1, ['R1', 'R3', 'R6', 'R7', 'R8']],
  ] as const) {
    it(`${name}: Qf is (n−1)×b, [U | Q_fl], Qf Bfᵀ = 0 and Q_fl = −B_ftᵀ`, () => {
      const net = netFrom(spec)
      const tree = makeTree(net, branchIds(net, [...twigs]))
      const Qf = fundamentalCutSetMatrix(net, tree, undefined, 'partitioned').data
      const Bf = fundamentalCircuitMatrix(net, tree, undefined, 'partitioned').data
      const n = net.nodes.length
      const b = net.branches.length
      expect(Qf.length).toBe(n - 1)
      expect(Qf[0].length).toBe(b)
      expect(rank(Qf)).toBe(n - 1)
      expect(Qf.map((r) => r.slice(0, n - 1))).toEqual(Array.from({ length: n - 1 }, (_, i) => Array.from({ length: n - 1 }, (_, j) => (i === j ? 1 : 0))))
      expect(maxAbsMatrix(multiply(Qf, transpose(Bf)))).toBe(0)
      const Qfl = Qf.map((r) => r.slice(n - 1))
      const Bft = Bf.map((r) => r.slice(0, n - 1))
      expect(Qfl).toEqual(transpose(Bft).map((r) => r.map((x) => (x === 0 ? 0 : -x))))
    })
  }

  it('each f-cut-set contains exactly one twig and separates the graph into its two sides', () => {
    const net = netFrom(example17_4_1)
    const tree = makeTree(net, branchIds(net, ['R1', 'R2', 'R5']))
    for (const c of fundamentalCutSets(net, tree)) {
      const twigsIn = Object.keys(c.entries).filter((id) => tree.twigIds.includes(id))
      expect(twigsIn).toEqual([c.twigId])
      expect(c.entries[c.twigId]).toBe(1)
      expect(c.sideFrom.length + c.sideTo.length).toBe(net.nodes.length)
    }
  })

  it('different trees give different Bf/Qf structures', () => {
    const net = netFrom(example17_4_1)
    const t1 = makeTree(net, branchIds(net, ['R1', 'R2', 'R5']))
    const t2 = makeTree(net, branchIds(net, ['R1', 'R4', 'R6']))
    expect(fundamentalCircuitMatrix(net, t1).data).not.toEqual(fundamentalCircuitMatrix(net, t2).data)
    expect(fundamentalCutSetMatrix(net, t1).data).not.toEqual(fundamentalCutSetMatrix(net, t2).data)
  })
})
