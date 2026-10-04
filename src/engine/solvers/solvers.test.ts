import { describe, expect, it } from 'vitest'
import type { AnalysisResult, MethodId } from '@/domain/analysis/types'
import { METHOD_IDS } from '@/domain/analysis/types'
import { compareMethods, runAnalysis } from '@/engine/solvers'
import { findSpanningTrees, suggestSpanningTree } from '@/engine/topology'
import { bridge, divider, example17_4_1, example17_7_1, fig17_2_1 } from '@/tests/fixtures/textbook'
import { branchIds, br, expectOk, netFrom, nodeId } from '@/tests/helpers'
import type { GraphSpec } from '@/domain/schematic/fromGraph'

function runAll(spec: GraphSpec, refLabel: string, twigs?: string[]) {
  const net = netFrom(spec)
  const tree = twigs ? branchIds(net, twigs) : suggestSpanningTree(net)!.twigIds
  const cfg = { referenceNodeId: nodeId(net, refLabel), treeBranchIds: tree }
  const out = {} as Record<MethodId, AnalysisResult>
  for (const m of METHOD_IDS) out[m] = expectOk(runAnalysis(m, net, cfg))
  return { net, out }
}

const potential = (r: AnalysisResult, id: string, ref: string) => r.nodeVoltages[id] - r.nodeVoltages[ref]

describe('Example 17.4-1 (nodal analysis, current sources)', () => {
  const { net, out } = runAll(example17_4_1, 'R')
  const R = nodeId(net, 'R')

  it('nodal analysis reproduces Yn and Vn = [2, 1, 3] V', () => {
    const r = out.nodal
    const Yn = r.matrices.find((m) => m.id === 'Yn')!.data
    expect(Yn).toEqual([
      [8, -1, -2],
      [-1, 4, -2],
      [-2, -2, 9],
    ])
    expect(r.nodeVoltages[nodeId(net, '1')]).toBeCloseTo(2, 10)
    expect(r.nodeVoltages[nodeId(net, '2')]).toBeCloseTo(1, 10)
    expect(r.nodeVoltages[nodeId(net, '3')]).toBeCloseTo(3, 10)
  })

  it('reproduces the source powers 18 W, 17 W and 42 W delivered', () => {
    const p = (l: string) => out.nodal.branches.find((q) => q.branchId === br(net, l).id)!.power
    expect(-p('I1')).toBeCloseTo(18, 10)
    expect(-p('I2')).toBeCloseTo(17, 10)
    expect(-p('I3')).toBeCloseTo(42, 10)
  })

  it.each(METHOD_IDS)('%s gives the same physical solution', (m) => {
    const r = out[m]
    for (const [l, v] of [
      ['1', 2],
      ['2', 1],
      ['3', 3],
    ] as const)
      expect(potential(r, nodeId(net, l), R)).toBeCloseTo(v, 9)
    for (const b of net.branches) expect(r.branchCurrents[b.id]).toBeCloseTo(out.nodal.branchCurrents[b.id], 9)
    expect(r.verification.overall).toBe('pass')
  })

  it('reproduces the textbook node-pair matrix size and orthogonality checks pass', () => {
    const r = out.nodePair
    expect(r.matrices.find((m) => m.id === 'Yt')!.data).toHaveLength(3)
    expect(r.verification.checks.find((c) => c.id === 'orthogonality-q')!.status).toBe('pass')
  })
})

describe('Example 17.7-1 (loop analysis, voltage sources)', () => {
  const twigs = ['V1', 'V2', 'V3', 'V4', 'R2', 'R4']
  const { net, out } = runAll(example17_7_1, 'G', twigs)

  it('loop analysis reproduces Z_L and I_l = [1, 2, 3] A', () => {
    const r = out.loop
    expect(r.matrices.find((m) => m.id === 'ZL')!.data).toEqual([
      [5, -3, 0],
      [-3, 5, -1],
      [0, -1, 5],
    ])
    expect(r.primary.map((p) => p.value)).toEqual([1, 2, 3].map((x) => expect.closeTo(x, 10)))
  })

  it('reproduces source currents I_g = [−1, −1, −1, 3] A and powers 5, 6, 2, 33 W', () => {
    const r = out.loop
    const ig = ['V1', 'V2', 'V3', 'V4'].map((l) => r.branchCurrents[br(net, l).id])
    ig.forEach((x, k) => expect(x).toBeCloseTo([-1, -1, -1, 3][k], 10))
    const delivered = ['V1', 'V2', 'V3', 'V4'].map((l) => -r.branches.find((q) => q.branchId === br(net, l).id)!.power)
    delivered.forEach((x, k) => expect(x).toBeCloseTo([5, 6, 2, 33][k], 10))
  })

  it.each(METHOD_IDS)('%s gives the same branch currents', (m) => {
    for (const b of net.branches) expect(out[m].branchCurrents[b.id]).toBeCloseTo(out.loop.branchCurrents[b.id], 9)
    expect(out[m].verification.overall).toBe('pass')
  })
})

describe('simple circuits: positive / negative / zero quantities', () => {
  it('voltage divider: i = 2 A, v(R2) = 4 V; source current negative under passive convention', () => {
    const { net, out } = runAll(divider, 'g')
    for (const m of METHOD_IDS) {
      const r = out[m]
      expect(r.branchCurrents[br(net, 'R1').id]).toBeCloseTo(2, 10)
      expect(r.branchVoltages[br(net, 'R2').id]).toBeCloseTo(4, 10)
      expect(r.branchCurrents[br(net, 'V1').id]).toBeCloseTo(-2, 10)
      expect(r.branches.find((q) => q.branchId === br(net, 'V1').id)!.power).toBeCloseTo(-24, 10)
    }
  })

  it('balanced bridge: zero current and zero voltage in the bridge branch; zero-valued current source', () => {
    const { net, out } = runAll(bridge, 'g')
    for (const m of METHOD_IDS) {
      const r = out[m]
      expect(r.branchCurrents[br(net, 'R5').id]).toBe(0)
      expect(r.branchVoltages[br(net, 'R5').id]).toBe(0)
      expect(r.branchCurrents[br(net, 'I1').id]).toBe(0)
      expect(potential(r, nodeId(net, 'l'), nodeId(net, 'g'))).toBeCloseTo(10 / 3, 10)
      expect(r.verification.overall).toBe('pass')
    }
  })
})

describe('reference node and tree independence', () => {
  it('different reference nodes give the same branch quantities', () => {
    const net = netFrom(example17_4_1)
    const base = expectOk(runAnalysis('nodal', net, { referenceNodeId: nodeId(net, 'R') }))
    for (const ref of ['1', '2', '3']) {
      const r = expectOk(runAnalysis('nodal', net, { referenceNodeId: nodeId(net, ref) }))
      expect(r.nodeVoltages[nodeId(net, ref)]).toBe(0)
      for (const b of net.branches) {
        expect(r.branchCurrents[b.id]).toBeCloseTo(base.branchCurrents[b.id], 9)
        expect(r.branchVoltages[b.id]).toBeCloseTo(base.branchVoltages[b.id], 9)
      }
      const inc = expectOk(runAnalysis('incidence', net, { referenceNodeId: nodeId(net, ref) }))
      for (const b of net.branches) expect(inc.branchVoltages[b.id]).toBeCloseTo(base.branchVoltages[b.id], 9)
    }
  })

  it('every spanning tree gives the same solution for loop, node-pair, Bf and Qf (including trees with sources as links/twigs)', () => {
    const net = netFrom(example17_4_1)
    const base = expectOk(runAnalysis('nodal', net, { referenceNodeId: nodeId(net, 'R') }))
    const trees = findSpanningTrees(net)
    expect(trees.length).toBeGreaterThan(20)
    for (const t of trees) {
      for (const m of ['loop', 'nodePair', 'fcircuit', 'fcutset'] as const) {
        const r = expectOk(runAnalysis(m, net, { treeBranchIds: t }))
        for (const b of net.branches) expect(r.branchCurrents[b.id]).toBeCloseTo(base.branchCurrents[b.id], 8)
      }
    }
  })

  it('Fig. 17.2-1 graph with sources: all 35 trees agree', () => {
    const spec: GraphSpec = {
      ...fig17_2_1,
      branches: fig17_2_1.branches.map((b, k) =>
        k === 0 ? { ...b, kind: 'voltageSource', value: 7, label: 'V1' } : k === 4 ? { ...b, kind: 'currentSource', value: 2, label: 'I1' } : { ...b, value: k + 1 },
      ),
    }
    const net = netFrom(spec)
    const base = expectOk(runAnalysis('nodal', net, { referenceNodeId: nodeId(net, '6') }))
    for (const t of findSpanningTrees(net)) {
      const r = expectOk(runAnalysis('loop', net, { treeBranchIds: t }))
      for (const b of net.branches) expect(r.branchVoltages[b.id]).toBeCloseTo(base.branchVoltages[b.id], 8)
    }
  })
})

describe('lazy analysis and error states', () => {
  it('nodal and incidence never build tree structures; tree methods never build A', () => {
    const net = netFrom(example17_4_1)
    const nodal = expectOk(runAnalysis('nodal', net, { referenceNodeId: nodeId(net, 'R') }))
    expect(nodal.tree).toBeNull()
    expect(nodal.matrices.map((m) => m.id)).not.toContain('Bf')
    const loop = expectOk(runAnalysis('loop', net, { treeBranchIds: suggestSpanningTree(net)!.twigIds }))
    expect(loop.matrices.map((m) => m.id)).not.toContain('A')
    expect(loop.matrices.map((m) => m.id)).not.toContain('Qf')
  })

  it('missing reference node / tree give actionable failures', () => {
    const net = netFrom(divider)
    const a = runAnalysis('nodal', net, {})
    expect(a.ok).toBe(false)
    if (!a.ok) expect(a.errors[0].message).toBe('Select a reference node before running nodal analysis.')
    const b = runAnalysis('loop', net, {})
    expect(!b.ok && b.errors[0].code).toBe('missing-tree')
    const c = runAnalysis('fcutset', net, { treeBranchIds: [br(net, 'R1').id] })
    expect(!c.ok && c.errors[0].code).toBe('invalid-tree')
  })

  it('a loop of voltage sources is ill-posed', () => {
    const spec: GraphSpec = {
      nodes: [
        { id: 'a', label: 'a', x: 0, y: 0 },
        { id: 'g', label: 'g', x: 0, y: 200, ground: true },
      ],
      branches: [
        { label: 'V1', kind: 'voltageSource', value: 5, from: 'a', to: 'g' },
        { label: 'V2', kind: 'voltageSource', value: 6, from: 'a', to: 'g' },
        { label: 'R1', kind: 'resistor', value: 1, from: 'a', to: 'g' },
      ],
    }
    const net = netFrom(spec)
    const r = runAnalysis('nodal', net, { referenceNodeId: nodeId(net, 'g') })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0].code).toBe('ill-posed')
      expect(r.errors[0].message).toMatch(/V2.*V1|V1.*V2/)
    }
  })

  it('a cut-set of current sources is ill-posed', () => {
    const spec: GraphSpec = {
      nodes: [
        { id: 'a', label: 'a', x: 0, y: 0 },
        { id: 'b', label: 'b', x: 200, y: 0 },
        { id: 'g', label: 'g', x: 0, y: 200, ground: true },
      ],
      branches: [
        { label: 'I1', kind: 'currentSource', value: 1, from: 'g', to: 'a' },
        { label: 'R1', kind: 'resistor', value: 1, from: 'a', to: 'g' },
        { label: 'I2', kind: 'currentSource', value: 2, from: 'a', to: 'b' },
        { label: 'R2', kind: 'resistor', value: 1, from: 'b', to: 'g' },
      ],
    }
    const ok = netFrom(spec)
    expect(runAnalysis('nodal', ok, { referenceNodeId: nodeId(ok, 'g') }).ok).toBe(true)
    const bad = netFrom({ ...spec, branches: spec.branches.filter((b) => b.label !== 'R2') })
    const r = runAnalysis('loop', bad, { treeBranchIds: suggestSpanningTree(bad)!.twigIds })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0].code).toBe('ill-posed')
  })
})

describe('method comparison', () => {
  it('runs only the selected methods and reports agreement', () => {
    const net = netFrom(example17_7_1)
    const c = compareMethods(net, ['nodal', 'loop', 'nodePair'], {})
    expect(Object.keys(c.outcomes)).toEqual(['nodal', 'loop', 'nodePair'])
    expect(c.usedSuggestedTree).toBe(true)
    expect(c.maxSpread).toBeLessThan(1e-9)
  })
})
