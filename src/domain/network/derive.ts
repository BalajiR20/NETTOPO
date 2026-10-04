import { ELEMENT_DESCRIPTORS, validateElementValue, type Element } from '@/domain/elements'
import { pinPosition } from '@/domain/schematic/geometry'
import { pinKey, type PinRef, type Schematic } from '@/domain/schematic/types'
import type { Branch, Network, NetworkIssue, NetworkNode } from './types'

class UnionFind {
  private parent = new Map<string, string>()
  add(x: string) {
    if (!this.parent.has(x)) this.parent.set(x, x)
  }
  find(x: string): string {
    let r = x
    while (this.parent.get(r) !== r) r = this.parent.get(r)!
    let c = x
    while (this.parent.get(c) !== r) {
      const n = this.parent.get(c)!
      this.parent.set(c, r)
      c = n
    }
    return r
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(rb, ra)
  }
}

export const GROUND_NODE_ID = 'gnd'

/**
 * Derives the linear oriented graph (§17.1) from the schematic.
 *
 * Wires are ideal interconnections: every pin joined by wires becomes ONE node
 * (the textbook's "bubble"). Every component becomes ONE oriented branch.
 * This function is pure and cheap; it computes only general network information.
 */
export function deriveNetwork(s: Schematic): Network {
  const uf = new UnionFind()
  const pins: PinRef[] = []
  const components = [...s.components].sort((a, b) => a.order - b.order)
  const markers = [...s.markers].sort((a, b) => a.order - b.order)
  for (const c of components) {
    pins.push({ ownerId: c.id, pin: 'a' }, { ownerId: c.id, pin: 'b' })
  }
  for (const m of markers) pins.push({ ownerId: m.id, pin: 'p' })
  for (const g of s.grounds) pins.push({ ownerId: g.id, pin: 'p' })
  for (const p of pins) uf.add(pinKey(p))
  for (const w of s.wires) {
    const a = pinKey(w.from)
    const b = pinKey(w.to)
    uf.add(a)
    uf.add(b)
    uf.union(a, b)
  }
  // All grounds are the same electrical node.
  const grounds = [...s.grounds].sort((a, b) => a.order - b.order)
  for (let i = 1; i < grounds.length; i++) uf.union(pinKey({ ownerId: grounds[0].id, pin: 'p' }), pinKey({ ownerId: grounds[i].id, pin: 'p' }))

  // Group pins by root, preserving discovery order (components, markers, grounds).
  const groups = new Map<string, PinRef[]>()
  for (const p of pins) {
    const r = uf.find(pinKey(p))
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(p)
  }

  const markerById = new Map(markers.map((m) => [m.id, m]))
  const groundIds = new Set(s.grounds.map((g) => g.id))
  const componentOrder = new Map(components.map((c, i) => [c.id, i]))
  const issues: NetworkIssue[] = []

  interface Draft {
    root: string
    pins: PinRef[]
    markerIds: string[]
    isGround: boolean
    sortKey: [number, number]
  }
  const drafts: Draft[] = []
  for (const [root, groupPins] of groups) {
    const markerIds = groupPins.filter((p) => markerById.has(p.ownerId)).map((p) => p.ownerId)
    const isGround = groupPins.some((p) => groundIds.has(p.ownerId))
    const firstMarker = markerIds.length ? markerById.get(markerIds[0])!.order : Infinity
    const firstComp = Math.min(
      ...groupPins.filter((p) => componentOrder.has(p.ownerId)).map((p) => componentOrder.get(p.ownerId)! * 2 + (p.pin === 'b' ? 1 : 0)),
    )
    // Order: marker nodes (by marker order), unnamed nets (by first pin), ground last.
    const sortKey: [number, number] = isGround ? [2, 0] : Number.isFinite(firstMarker) ? [0, firstMarker] : [1, firstComp]
    drafts.push({ root, pins: groupPins, markerIds, isGround, sortKey })
  }
  drafts.sort((a, b) => a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1])

  const usedLabels = new Set<string>()
  for (const m of markers) if (m.kind === 'node' && m.label.trim()) usedLabels.add(m.label.trim())
  let autoCounter = 1
  const nextAutoLabel = () => {
    while (usedLabels.has(`n${autoCounter}`)) autoCounter++
    const l = `n${autoCounter}`
    usedLabels.add(l)
    return l
  }

  const nodes: NetworkNode[] = []
  const pinToNode = new Map<string, string>()
  for (const d of drafts) {
    const namedMarkers = d.markerIds.map((id) => markerById.get(id)!).filter((m) => m.kind === 'node' && m.label.trim())
    let id: string
    let label: string
    if (d.isGround) {
      id = GROUND_NODE_ID
      label = namedMarkers[0]?.label.trim() ?? 'GND'
    } else if (namedMarkers.length) {
      id = namedMarkers[0].id
      label = namedMarkers[0].label.trim()
    } else if (d.markerIds.length) {
      id = d.markerIds[0]
      label = nextAutoLabel()
    } else {
      const first = d.pins[0]
      id = `net:${first.ownerId}:${first.pin}`
      label = nextAutoLabel()
    }
    if (namedMarkers.length > 1) {
      issues.push({
        code: 'multiple-labels',
        severity: 'warning',
        message: `Node markers ${namedMarkers.map((m) => m.label).join(', ')} are wired together and form one node "${label}".`,
        hint: 'Remove the wire between them if they should be different nodes.',
        nodeIds: [id],
      })
    }
    const positions = d.markerIds.length
      ? d.markerIds.map((mid) => markerById.get(mid)!.position)
      : d.pins.map((p) => pinPosition(s, p.ownerId, p.pin)).filter((p): p is { x: number; y: number } => !!p)
    const position = positions.length
      ? { x: positions.reduce((a, p) => a + p.x, 0) / positions.length, y: positions.reduce((a, p) => a + p.y, 0) / positions.length }
      : { x: 0, y: 0 }
    const pinKeys = d.pins.map(pinKey)
    for (const k of pinKeys) pinToNode.set(k, id)
    nodes.push({ id, label, position, isGround: d.isGround, markerIds: d.markerIds, pinKeys })
  }

  const branches: Branch[] = components.map((c, i) => {
    const na = pinToNode.get(pinKey({ ownerId: c.id, pin: 'a' }))!
    const nb = pinToNode.get(pinKey({ ownerId: c.id, pin: 'b' }))!
    const k = i + 1
    const element: Element = { id: `el:${c.id}`, type: c.kind, value: c.value, parameters: {} } as Element
    return {
      id: c.id,
      index: k,
      label: `b${k}`,
      fromNode: c.reversed ? nb : na,
      toNode: c.reversed ? na : nb,
      orientation: c.reversed ? 'b-to-a' : 'a-to-b',
      polarity: c.reversed ? -1 : 1,
      element,
      elementLabel: c.label || `${ELEMENT_DESCRIPTORS[c.kind].symbolLetter}${k}`,
      componentId: c.id,
      currentVariable: `i_{${k}}`,
      voltageVariable: `v_{${k}}`,
    }
  })

  /* ------------------------------ structural issues ------------------------------ */
  if (branches.length === 0) {
    issues.push({
      code: 'empty',
      severity: 'error',
      message: 'The circuit has no components.',
      hint: 'Drag a resistor, voltage source or current source from the toolbox onto the canvas.',
    })
  }
  for (const b of branches) {
    const err = validateElementValue(b.element.type, b.element.value)
    if (err) {
      issues.push({
        code: 'invalid-value',
        severity: 'error',
        message: `${b.elementLabel} (${b.label}): ${err}`,
        hint: `Select ${b.elementLabel} and correct its value in the Properties panel.`,
        branchIds: [b.id],
        componentIds: [b.componentId],
      })
    }
    if (b.fromNode === b.toNode) {
      issues.push({
        code: 'self-loop',
        severity: 'error',
        message: `${b.elementLabel} (${b.label}) has both terminals on the same node "${nodes.find((n) => n.id === b.fromNode)?.label}".`,
        hint: 'A branch must connect two different nodes. Remove the wire that short-circuits it.',
        branchIds: [b.id],
        componentIds: [b.componentId],
      })
    }
  }
  const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]))
  for (const b of branches) {
    degree.set(b.fromNode, (degree.get(b.fromNode) ?? 0) + 1)
    degree.set(b.toNode, (degree.get(b.toNode) ?? 0) + 1)
  }
  for (const n of nodes) {
    const d = degree.get(n.id) ?? 0
    const hasComponentPin = n.pinKeys.some((k) => componentOrder.has(k.slice(0, k.lastIndexOf(':'))))
    if (!hasComponentPin) {
      issues.push({
        code: 'floating-node',
        severity: 'error',
        message: `Node "${n.label}" is floating: no branch is connected to it.`,
        hint: 'Wire it to a component terminal, or delete it.',
        nodeIds: [n.id],
      })
    } else if (d === 1 && n.markerIds.length === 0 && !n.isGround) {
      const b = branches.find((x) => x.fromNode === n.id || x.toNode === n.id)
      issues.push({
        code: 'unconnected-pin',
        severity: 'warning',
        message: `A terminal of ${b?.elementLabel ?? 'a component'} is not connected to anything (node "${n.label}").`,
        hint: 'An open terminal carries no current. Wire it if that was not intended.',
        nodeIds: [n.id],
        componentIds: b ? [b.componentId] : [],
      })
    }
  }

  // Connected components of the graph (nodes joined by branches).
  const cuf = new UnionFind()
  for (const n of nodes) cuf.add(n.id)
  for (const b of branches) cuf.union(b.fromNode, b.toNode)
  const roots = new Set(nodes.map((n) => cuf.find(n.id)))
  if (nodes.length > 0 && branches.length > 0 && roots.size > 1) {
    issues.push({
      code: 'disconnected',
      severity: 'error',
      message: `The graph is not connected: it has ${roots.size} separate parts.`,
      hint: 'Topological analysis (§17.1) requires a connected graph. Wire the separate parts together.',
    })
  }

  return {
    nodes,
    branches,
    groundNodeId: nodes.find((n) => n.isGround)?.id ?? null,
    issues,
  }
}

/** Errors that block every analysis. */
export const blockingIssues = (net: Network) => net.issues.filter((i) => i.severity === 'error')

/** Signature of everything topology-dependent (nodes, branch endpoints, orientation, element kind). */
export function topologySignature(net: Network): string {
  return [
    net.nodes.map((n) => n.id).join(','),
    net.branches.map((b) => `${b.id}:${b.fromNode}>${b.toNode}:${b.element.type}`).join(','),
  ].join('|')
}

/** Signature of element values only. */
export function valueSignature(net: Network): string {
  return net.branches.map((b) => `${b.id}=${b.element.value}`).join(',')
}
