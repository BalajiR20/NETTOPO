import type { ElementKind } from '@/domain/elements'
import { ELEMENT_DESCRIPTORS } from '@/domain/elements'
import type { Point, Rotation, Schematic, SchematicComponent, Wire } from './types'
import { GROUND_SIZE } from './geometry'

/**
 * Describes a circuit as an oriented graph and lays it out as a schematic:
 * one node marker per node (plus optional junction "taps" forming a rail),
 * one component per branch, wires from component pins to the nearest marker
 * of each node. Used by the built-in examples and by tests, so every example
 * goes through exactly the same deriveNetwork() path as a user-drawn circuit.
 */
export interface GraphSpecNode {
  id: string
  label: string
  x: number
  y: number
  ground?: boolean
  /** Extra junction points belonging to this node. Each is wired to the nearest already-placed point of the node. */
  taps?: Point[]
}

export interface GraphSpecBranch {
  /** Element label (R1, V1, I1). */
  label: string
  kind: ElementKind
  value: number
  /** Branch orientation: from → to. Element pin a sits on `from` unless `reversed`. */
  from: string
  to: string
  /** When true, the element's pin a sits on `to` (source polarity opposes the branch, s = −1). */
  reversed?: boolean
  /** Explicit component centre; default = midpoint between the attachment points. */
  at?: Point
  rotation?: Rotation
  /** Attachment point indices [from-node, to-node]: 0 = main marker, k = taps[k − 1]. Default: best axis-aligned pair. */
  attach?: [number, number]
}

export interface GraphSpec {
  nodes: GraphSpecNode[]
  branches: GraphSpecBranch[]
}

export function schematicFromGraph(spec: GraphSpec, idPrefix = 'x'): Schematic {
  const s: Schematic = { components: [], markers: [], grounds: [], wires: [] }
  const points = new Map<string, { markerId: string; p: Point }[]>()
  let order = 0
  let wireCount = 0
  const wire = (from: Wire['from'], to: Wire['to']) => {
    s.wires.push({ id: `${idPrefix}w${++wireCount}`, from, to })
  }

  for (const n of spec.nodes) {
    const markerId = `${idPrefix}n${n.id}`
    s.markers.push({ id: markerId, kind: 'node', label: n.label, position: { x: n.x, y: n.y }, order: order++ })
    const list = [{ markerId, p: { x: n.x, y: n.y } }]
    ;(n.taps ?? []).forEach((t, k) => {
      const jid = `${idPrefix}j${n.id}t${k}`
      s.markers.push({ id: jid, kind: 'junction', label: '', position: { ...t }, order: order++ })
      const nearest = list.reduce((best, q) => (Math.hypot(q.p.x - t.x, q.p.y - t.y) < Math.hypot(best.p.x - t.x, best.p.y - t.y) ? q : best))
      wire({ ownerId: nearest.markerId, pin: 'p' }, { ownerId: jid, pin: 'p' })
      list.push({ markerId: jid, p: { ...t } })
    })
    points.set(n.id, list)
    if (n.ground) {
      const gid = `${idPrefix}g${n.id}`
      s.grounds.push({ id: gid, position: { x: n.x, y: n.y + GROUND_SIZE / 2 + 40 }, order: order++ })
      wire({ ownerId: markerId, pin: 'p' }, { ownerId: gid, pin: 'p' })
    }
  }

  const pairCount = new Map<string, number>()
  spec.branches.forEach((b, i) => {
    const fromPts = points.get(b.from)
    const toPts = points.get(b.to)
    if (!fromPts || !toPts) throw new Error(`Branch ${b.label} references an unknown node.`)
    const aPts = b.reversed ? toPts : fromPts
    const bPts = b.reversed ? fromPts : toPts
    // Attachment points: prefer an axis-aligned pair, then the shortest.
    let best = { a: aPts[0], b: bPts[0], score: Infinity }
    if (b.attach) {
      const [fi, ti] = b.attach
      const fp = fromPts[fi] ?? fromPts[0]
      const tp = toPts[ti] ?? toPts[0]
      best = { a: b.reversed ? tp : fp, b: b.reversed ? fp : tp, score: 0 }
    } else for (const pa of aPts)
      for (const pb of bPts) {
        const dx = Math.abs(pa.p.x - pb.p.x)
        const dy = Math.abs(pa.p.y - pb.p.y)
        const score = dx + dy + (dx > 0 && dy > 0 ? 10000 : 0)
        if (score < best.score) best = { a: pa, b: pb, score }
      }
    const pa = best.a.p
    const pb = best.b.p
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const rotation: Rotation = b.rotation ?? (horizontal ? (dx >= 0 ? 0 : 180) : dy >= 0 ? 90 : 270)

    const key = [best.a.markerId, best.b.markerId].sort().join('|')
    const k = pairCount.get(key) ?? 0
    pairCount.set(key, k + 1)
    const offset = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * 100
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
    const at = b.at ?? (horizontal ? { x: mid.x, y: mid.y + offset } : { x: mid.x + offset, y: mid.y })

    const id = `${idPrefix}c${i + 1}`
    const comp: SchematicComponent = {
      id,
      kind: b.kind,
      label: b.label || `${ELEMENT_DESCRIPTORS[b.kind].symbolLetter}${i + 1}`,
      value: b.value,
      position: at,
      rotation,
      reversed: !!b.reversed,
      order: order++,
    }
    s.components.push(comp)
    wire({ ownerId: id, pin: 'a' }, { ownerId: best.a.markerId, pin: 'p' })
    wire({ ownerId: id, pin: 'b' }, { ownerId: best.b.markerId, pin: 'p' })
  })
  return s
}
