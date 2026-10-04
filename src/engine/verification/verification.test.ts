import { describe, expect, it } from 'vitest'
import { runAnalysis } from '@/engine/solvers'
import { suggestSpanningTree } from '@/engine/topology'
import { classify, verify } from '@/engine/verification'
import { example17_4_1, example17_7_1 } from '@/tests/fixtures/textbook'
import { expectOk, netFrom, nodeId } from '@/tests/helpers'

describe('verification engine', () => {
  const net = netFrom(example17_7_1)
  const r = expectOk(runAnalysis('loop', net, { treeBranchIds: suggestSpanningTree(net)!.twigIds }))
  const v = net.branches.map((b) => r.branchVoltages[b.id])
  const i = net.branches.map((b) => r.branchCurrents[b.id])

  it('passes KCL, KVL, element relations and Tellegen for a correct solution', () => {
    const rep = verify({ net, v, i })
    for (const id of ['kcl', 'kvl', 'element', 'tellegen'] as const) {
      const c = rep.checks.find((x) => x.id === id)!
      expect(c.status).toBe('pass')
      expect(c.residual).toBeLessThan(1e-9)
    }
  })

  it('Tellegen residual is the actual Σ vₖ iₖ from the solution', () => {
    const rep = verify({ net, v, i })
    const t = rep.checks.find((x) => x.id === 'tellegen')!
    expect(t.residual).toBeCloseTo(Math.abs(v.reduce((s, x, k) => s + x * i[k], 0)), 15)
    expect(t.items).toHaveLength(net.branches.length)
  })

  it('detects a KCL violation (corrupted current)', () => {
    const bad = i.slice()
    bad[4] += 0.5
    const rep = verify({ net, v, i: bad })
    expect(rep.checks.find((x) => x.id === 'kcl')!.status).toBe('fail')
    expect(rep.checks.find((x) => x.id === 'kcl')!.residual).toBeCloseTo(0.5, 12)
    expect(rep.overall).toBe('fail')
  })

  it('detects a KVL violation (corrupted voltage)', () => {
    const bad = v.slice()
    bad[5] += 1e-3
    const rep = verify({ net, v: bad, i })
    expect(rep.checks.find((x) => x.id === 'kvl')!.status).toBe('fail')
  })

  it('detects that a solution violating KVL also breaks Tellegen', () => {
    const bad = v.slice()
    bad[0] += 2
    const rep = verify({ net, v: bad, i })
    expect(rep.checks.find((x) => x.id === 'tellegen')!.status).toBe('fail')
  })

  it('tree methods add tree, orthogonality and dimension checks', () => {
    const tree = suggestSpanningTree(net)!
    const rep = verify({ net, v, i, tree })
    for (const id of ['tree', 'orthogonality-a', 'orthogonality-q', 'dimensions'] as const) expect(rep.checks.find((x) => x.id === id)!.status).toBe('pass')
  })

  it('classifies residuals with relative tolerance', () => {
    expect(classify(1e-12, 1)).toBe('pass')
    expect(classify(1e-8, 1)).toBe('warning')
    expect(classify(1e-3, 1)).toBe('fail')
    expect(classify(1e-7, 1000)).toBe('pass')
    expect(classify(Number.NaN, 1)).toBe('fail')
  })

  it('nodal results carry the full verification report', () => {
    const n = netFrom(example17_4_1)
    const res = expectOk(runAnalysis('nodal', n, { referenceNodeId: nodeId(n, 'R') }))
    expect(res.verification.checks.map((c) => c.id)).toEqual(['kcl', 'kvl', 'element', 'tellegen', 'residual'])
    expect(res.verification.overall).toBe('pass')
  })
})
