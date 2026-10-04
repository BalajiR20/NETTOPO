import { describe, expect, it } from 'vitest'
import { runAnalysis } from '@/engine/solvers'
import { availableSignals, evaluate, measure, signalFromResult } from '@/engine/simulation'
import { divider } from '@/tests/fixtures/textbook'
import { br, expectOk, netFrom, nodeId } from '@/tests/helpers'

describe('simulation signal model', () => {
  const net = netFrom(divider)
  const r = expectOk(runAnalysis('nodal', net, { referenceNodeId: nodeId(net, 'g') }))

  it('builds DC signals from the actual analysis result', () => {
    const s = signalFromResult(r, 'branch-current', br(net, 'R1').id)!
    expect(s.definition).toEqual({ kind: 'dc', value: r.branchCurrents[br(net, 'R1').id] })
    expect(evaluate(s.definition, 0)).toBeCloseTo(2, 12)
    expect(evaluate(s.definition, 12.5)).toBeCloseTo(2, 12)
    const m = measure(s.definition, 0, 1)
    expect(m.peakToPeak).toBe(0)
    expect(m.mean).toBeCloseTo(2, 12)
  })

  it('lists every branch current, branch voltage, node voltage and power', () => {
    const opts = availableSignals(r)
    expect(opts).toHaveLength(net.branches.length * 3 + net.nodes.length)
  })

  it('returns null for targets that are not in the result', () => {
    expect(signalFromResult(r, 'branch-current', 'nope')).toBeNull()
  })

  it('supports sampled and sinusoidal definitions for future analyses', () => {
    expect(evaluate({ kind: 'sampled', t: [0, 1, 2], y: [0, 10, 0] }, 0.5)).toBe(5)
    expect(evaluate({ kind: 'sinusoid', amplitude: 2, frequency: 1, phase: 0, offset: 1 }, 0)).toBe(3)
  })
})
