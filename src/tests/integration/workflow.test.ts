import { beforeEach, describe, expect, it } from 'vitest'
import { deriveNetwork } from '@/domain/network/derive'
import { emptySchematic } from '@/domain/schematic/types'
import { useAnalysisStore } from '@/store/analysisStore'
import { useCircuitStore } from '@/store/circuitStore'

/**
 * Integration: circuit editing (store actions) → derived network → method →
 * solver → result, including the invalidation policy of §47.
 */
function buildDivider() {
  const c = useCircuitStore.getState()
  c.load(emptySchematic())
  const v = c.addComponent('voltageSource', { x: 0, y: 100 })
  const r1 = c.addComponent('resistor', { x: 100, y: 0 })
  const r2 = c.addComponent('resistor', { x: 200, y: 100 })
  const g = c.addGround({ x: 100, y: 240 })
  c.updateComponent(v, { value: 12, rotation: 90 })
  c.updateComponent(r1, { value: 4 })
  c.updateComponent(r2, { value: 2, rotation: 90 })
  // V+ (pin a) — R1 — R2 — ground — V− (pin b)
  c.addWire({ ownerId: v, pin: 'a' }, { ownerId: r1, pin: 'a' })
  c.addWire({ ownerId: r1, pin: 'b' }, { ownerId: r2, pin: 'a' })
  c.addWire({ ownerId: r2, pin: 'b' }, { ownerId: g, pin: 'p' })
  c.addWire({ ownerId: v, pin: 'b' }, { ownerId: g, pin: 'p' })
  return { v, r1, r2, g }
}

const net = () => deriveNetwork(useCircuitStore.getState().schematic)

describe('editor → network → analysis workflow', () => {
  beforeEach(() => useAnalysisStore.getState().reset())

  it('builds a circuit with store actions and derives the oriented graph', () => {
    buildDivider()
    const n = net()
    expect(n.nodes).toHaveLength(3)
    expect(n.branches).toHaveLength(3)
    expect(n.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('nodal analysis via the analysis store gives the divider solution', () => {
    const { r1, r2 } = buildDivider()
    const a = useAnalysisStore.getState()
    a.selectMethod('nodal', net())
    a.setReference(net().groundNodeId)
    const out = useAnalysisStore.getState().run(net())!
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.branchCurrents[r1]).toBeCloseTo(2, 12)
      expect(out.branchVoltages[r2]).toBeCloseTo(4, 12)
      expect(out.verification.overall).toBe('pass')
    }
  })

  it('value change re-solves automatically with the same method', () => {
    const { r2 } = buildDivider()
    const a = useAnalysisStore.getState()
    a.selectMethod('nodal', net())
    a.setReference(net().groundNodeId)
    a.run(net())
    useCircuitStore.getState().updateComponent(r2, { value: 8 })
    useAnalysisStore.getState().onNetworkChanged(net())
    const out = useAnalysisStore.getState().outcome!
    expect(out.ok && out.branchVoltages[r2]).toBeCloseTo(12 * 8 / 12, 12)
  })

  it('topology change invalidates results and the tree confirmation', () => {
    const { r1 } = buildDivider()
    const a = useAnalysisStore.getState()
    a.selectMethod('loop', net())
    a.suggestTree(net())
    a.confirmTree()
    expect(useAnalysisStore.getState().run(net())?.ok).toBe(true)
    useCircuitStore.getState().reverseOrientation([r1])
    useAnalysisStore.getState().onNetworkChanged(net())
    const st = useAnalysisStore.getState()
    expect(st.outcome).toBeNull()
    expect(st.treeConfirmed).toBe(false)
    expect(st.invalidationNotice).toMatch(/topology changed/)
  })

  it('position-only changes do not invalidate or recompute', () => {
    const { r1 } = buildDivider()
    const a = useAnalysisStore.getState()
    a.selectMethod('nodal', net())
    a.setReference(net().groundNodeId)
    const out = a.run(net())
    useCircuitStore.getState().setLive((s) => ({ ...s, components: s.components.map((c) => (c.id === r1 ? { ...c, position: { x: 500, y: 500 } } : c)) }))
    useAnalysisStore.getState().onNetworkChanged(net())
    expect(useAnalysisStore.getState().outcome).toBe(out)
  })

  it('undo / redo restore the schematic', () => {
    const { r1 } = buildDivider()
    const before = useCircuitStore.getState().schematic
    useCircuitStore.getState().deleteItems([r1])
    expect(net().branches).toHaveLength(2)
    useCircuitStore.getState().undo()
    expect(useCircuitStore.getState().schematic).toBe(before)
    useCircuitStore.getState().redo()
    expect(net().branches).toHaveLength(2)
  })

  it('copy / paste duplicates components with fresh ids and labels', () => {
    const { r1 } = buildDivider()
    useCircuitStore.getState().copy([r1])
    const ids = useCircuitStore.getState().paste()
    expect(ids).toHaveLength(1)
    const c = useCircuitStore.getState().schematic.components.find((x) => x.id === ids[0])!
    expect(c.label).not.toBe('R1')
    expect(c.value).toBe(4)
  })

  it('reports an actionable error when the reference node is missing', () => {
    buildDivider()
    const a = useAnalysisStore.getState()
    a.selectMethod('incidence', net())
    const out = a.run(net())!
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.errors[0].code).toBe('missing-reference')
  })
})
