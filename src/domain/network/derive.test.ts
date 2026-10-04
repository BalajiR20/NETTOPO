import { describe, expect, it } from 'vitest'
import { deriveNetwork, topologySignature, valueSignature, GROUND_NODE_ID } from '@/domain/network/derive'
import { schematicFromGraph } from '@/domain/schematic/fromGraph'
import { schematicSchema, type Schematic } from '@/domain/schematic/types'
import { divider, example17_4_1 } from '@/tests/fixtures/textbook'

describe('deriveNetwork (schematic → oriented graph)', () => {
  it('merges wired pins into nodes and maps each component to one branch', () => {
    const net = deriveNetwork(schematicFromGraph(example17_4_1))
    expect(net.nodes).toHaveLength(4)
    expect(net.branches).toHaveLength(9)
    expect(net.branches.map((b) => b.label)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'])
    expect(net.groundNodeId).toBe(GROUND_NODE_ID)
    expect(net.nodes[net.nodes.length - 1].isGround).toBe(true)
    expect(net.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('positions do not affect topology', () => {
    const s = schematicFromGraph(divider)
    const moved: Schematic = { ...s, components: s.components.map((c) => ({ ...c, position: { x: c.position.x + 500, y: c.position.y - 77 } })) }
    expect(topologySignature(deriveNetwork(moved))).toBe(topologySignature(deriveNetwork(s)))
  })

  it('value changes alter only the value signature', () => {
    const s = schematicFromGraph(divider)
    const changed: Schematic = { ...s, components: s.components.map((c, k) => (k === 1 ? { ...c, value: 99 } : c)) }
    const a = deriveNetwork(s)
    const b = deriveNetwork(changed)
    expect(topologySignature(a)).toBe(topologySignature(b))
    expect(valueSignature(a)).not.toBe(valueSignature(b))
  })

  it('reports a self-loop, a floating node, an invalid value and a disconnected graph', () => {
    const s: Schematic = {
      components: [
        { id: 'r1', kind: 'resistor', label: 'R1', value: 0, position: { x: 0, y: 0 }, rotation: 0, reversed: false, order: 0 },
        { id: 'r2', kind: 'resistor', label: 'R2', value: 5, position: { x: 0, y: 200 }, rotation: 0, reversed: false, order: 1 },
        { id: 'r3', kind: 'resistor', label: 'R3', value: 5, position: { x: 400, y: 200 }, rotation: 0, reversed: false, order: 2 },
      ],
      markers: [{ id: 'm1', kind: 'node', label: 'X', position: { x: 900, y: 900 }, order: 3 }],
      grounds: [],
      wires: [{ id: 'w1', from: { ownerId: 'r1', pin: 'a' }, to: { ownerId: 'r1', pin: 'b' } }],
    }
    const codes = deriveNetwork(s).issues.map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['self-loop', 'floating-node', 'invalid-value', 'disconnected']))
  })

  it('all ground symbols form one node', () => {
    const s: Schematic = {
      components: [{ id: 'r1', kind: 'resistor', label: 'R1', value: 5, position: { x: 0, y: 0 }, rotation: 0, reversed: false, order: 0 }],
      markers: [],
      grounds: [
        { id: 'g1', position: { x: -40, y: 40 }, order: 1 },
        { id: 'g2', position: { x: 40, y: 40 }, order: 2 },
      ],
      wires: [
        { id: 'w1', from: { ownerId: 'r1', pin: 'a' }, to: { ownerId: 'g1', pin: 'p' } },
        { id: 'w2', from: { ownerId: 'r1', pin: 'b' }, to: { ownerId: 'g2', pin: 'p' } },
      ],
    }
    expect(deriveNetwork(s).issues.map((i) => i.code)).toContain('self-loop')
  })

  it('schema rejects dangling wires and duplicate ids', () => {
    const s = schematicFromGraph(divider)
    expect(schematicSchema.safeParse(s).success).toBe(true)
    const bad = { ...s, wires: [...s.wires, { id: 'zz', from: { ownerId: 'nope', pin: 'a' }, to: { ownerId: s.components[0].id, pin: 'b' } }] }
    expect(schematicSchema.safeParse(bad).success).toBe(false)
    const dup = { ...s, wires: [...s.wires, { ...s.wires[0] }] }
    expect(schematicSchema.safeParse(dup).success).toBe(false)
  })
})
