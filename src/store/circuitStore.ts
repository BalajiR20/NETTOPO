import { create } from 'zustand'
import { ELEMENT_DESCRIPTORS, type ElementKind } from '@/domain/elements'
import { nextRotation, snap } from '@/domain/schematic/geometry'
import {
  emptySchematic,
  type MarkerKind,
  type PinRef,
  type Point,
  type Schematic,
  type SchematicComponent,
  type SchematicMarker,
  type Wire,
} from '@/domain/schematic/types'
import { uid } from '@/lib/id'

const HISTORY_LIMIT = 100

interface Clipboard {
  components: SchematicComponent[]
  markers: SchematicMarker[]
  grounds: Schematic['grounds']
  wires: Wire[]
}

export interface CircuitState {
  schematic: Schematic
  past: Schematic[]
  future: Schematic[]
  /** Snapshot taken at the start of a drag gesture. */
  gestureStart: Schematic | null
  clipboard: Clipboard | null
  /** Incremented on every change; used by autosave. */
  revision: number

  load(s: Schematic): void
  commit(update: (s: Schematic) => Schematic): void
  /** Update without a history entry (live drag). */
  setLive(update: (s: Schematic) => Schematic): void
  beginGesture(): void
  endGesture(): void
  undo(): void
  redo(): void

  addComponent(kind: ElementKind, position: Point): string
  addMarker(kind: MarkerKind, position: Point): string
  addGround(position: Point): string
  addWire(from: PinRef, to: PinRef): string | null
  updateComponent(id: string, patch: Partial<Omit<SchematicComponent, 'id'>>): void
  updateMarker(id: string, patch: Partial<Omit<SchematicMarker, 'id'>>): void
  rotate(ids: string[]): void
  reverseOrientation(ids: string[]): void
  deleteItems(ids: string[]): void
  copy(ids: string[]): void
  paste(): string[]
}

const nextOrder = (s: Schematic) => Math.max(-1, ...s.components.map((c) => c.order), ...s.markers.map((m) => m.order), ...s.grounds.map((g) => g.order)) + 1

export function nextLabel(s: Schematic, kind: ElementKind | MarkerKind): string {
  const prefix = kind === 'node' ? 'N' : kind === 'junction' ? 'J' : ELEMENT_DESCRIPTORS[kind as ElementKind].symbolLetter
  const used = new Set([...s.components.map((c) => c.label), ...s.markers.map((m) => m.label)])
  let k = 1
  while (used.has(`${prefix}${k}`)) k++
  return `${prefix}${k}`
}

const sameWire = (w: Wire, a: PinRef, b: PinRef) =>
  (w.from.ownerId === a.ownerId && w.from.pin === a.pin && w.to.ownerId === b.ownerId && w.to.pin === b.pin) ||
  (w.from.ownerId === b.ownerId && w.from.pin === b.pin && w.to.ownerId === a.ownerId && w.to.pin === a.pin)

export const useCircuitStore = create<CircuitState>((set, get) => {
  const commit = (update: (s: Schematic) => Schematic) => {
    const prev = get().schematic
    const next = update(prev)
    if (next === prev) return
    set((st) => ({ schematic: next, past: [...st.past, prev].slice(-HISTORY_LIMIT), future: [], revision: st.revision + 1 }))
  }
  return {
    schematic: emptySchematic(),
    past: [],
    future: [],
    gestureStart: null,
    clipboard: null,
    revision: 0,

    load: (s) => set((st) => ({ schematic: s, past: [], future: [], gestureStart: null, revision: st.revision + 1 })),
    commit,
    setLive: (update) => set((st) => ({ schematic: update(st.schematic), revision: st.revision + 1 })),
    beginGesture: () => set((st) => ({ gestureStart: st.gestureStart ?? st.schematic })),
    endGesture: () => {
      const { gestureStart, schematic } = get()
      if (!gestureStart) return
      if (gestureStart !== schematic) set((st) => ({ past: [...st.past, gestureStart].slice(-HISTORY_LIMIT), future: [], gestureStart: null }))
      else set({ gestureStart: null })
    },
    undo: () => {
      const { past, schematic, future } = get()
      if (!past.length) return
      set((st) => ({ schematic: past[past.length - 1], past: past.slice(0, -1), future: [schematic, ...future], revision: st.revision + 1 }))
    },
    redo: () => {
      const { past, schematic, future } = get()
      if (!future.length) return
      set((st) => ({ schematic: future[0], future: future.slice(1), past: [...past, schematic], revision: st.revision + 1 }))
    },

    addComponent: (kind, position) => {
      const id = uid('c')
      commit((s) => ({
        ...s,
        components: [
          ...s.components,
          {
            id,
            kind,
            label: nextLabel(s, kind),
            value: ELEMENT_DESCRIPTORS[kind].defaultValue,
            position: { x: snap(position.x), y: snap(position.y) },
            rotation: 0,
            reversed: false,
            order: nextOrder(s),
          },
        ],
      }))
      return id
    },
    addMarker: (kind, position) => {
      const id = uid(kind === 'node' ? 'n' : 'j')
      commit((s) => ({
        ...s,
        markers: [...s.markers, { id, kind, label: kind === 'node' ? nextLabel(s, 'node') : '', position: { x: snap(position.x), y: snap(position.y) }, order: nextOrder(s) }],
      }))
      return id
    },
    addGround: (position) => {
      const id = uid('g')
      commit((s) => ({ ...s, grounds: [...s.grounds, { id, position: { x: snap(position.x), y: snap(position.y) }, order: nextOrder(s) }] }))
      return id
    },
    addWire: (from, to) => {
      if (from.ownerId === to.ownerId && from.pin === to.pin) return null
      const s = get().schematic
      if (s.wires.some((w) => sameWire(w, from, to))) return null
      const id = uid('w')
      commit((sc) => ({ ...sc, wires: [...sc.wires, { id, from, to }] }))
      return id
    },
    updateComponent: (id, patch) =>
      commit((s) => ({ ...s, components: s.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    updateMarker: (id, patch) => commit((s) => ({ ...s, markers: s.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    rotate: (ids) =>
      commit((s) =>
        ids.some((id) => s.components.some((c) => c.id === id))
          ? { ...s, components: s.components.map((c) => (ids.includes(c.id) ? { ...c, rotation: nextRotation(c.rotation) } : c)) }
          : s,
      ),
    reverseOrientation: (ids) =>
      commit((s) =>
        ids.some((id) => s.components.some((c) => c.id === id))
          ? { ...s, components: s.components.map((c) => (ids.includes(c.id) ? { ...c, reversed: !c.reversed } : c)) }
          : s,
      ),
    deleteItems: (ids) => {
      if (!ids.length) return
      const set_ = new Set(ids)
      commit((s) => ({
        components: s.components.filter((c) => !set_.has(c.id)),
        markers: s.markers.filter((m) => !set_.has(m.id)),
        grounds: s.grounds.filter((g) => !set_.has(g.id)),
        wires: s.wires.filter((w) => !set_.has(w.id) && !set_.has(w.from.ownerId) && !set_.has(w.to.ownerId)),
      }))
    },
    copy: (ids) => {
      const s = get().schematic
      const set_ = new Set(ids)
      const components = s.components.filter((c) => set_.has(c.id))
      const markers = s.markers.filter((m) => set_.has(m.id))
      const grounds = s.grounds.filter((g) => set_.has(g.id))
      const owners = new Set([...components, ...markers, ...grounds].map((x) => x.id))
      const wires = s.wires.filter((w) => owners.has(w.from.ownerId) && owners.has(w.to.ownerId))
      if (owners.size) set({ clipboard: { components, markers, grounds, wires } })
    },
    paste: () => {
      const clip = get().clipboard
      if (!clip) return []
      const map = new Map<string, string>()
      const fresh = (old: string, prefix: string) => {
        const id = uid(prefix)
        map.set(old, id)
        return id
      }
      const offset = 40
      const created: string[] = []
      commit((s) => {
        let order = nextOrder(s)
        let draft: Schematic = s
        const components = clip.components.map((c) => {
          const comp = { ...c, id: fresh(c.id, 'c'), position: { x: c.position.x + offset, y: c.position.y + offset }, order: order++ }
          comp.label = nextLabel(draft, c.kind)
          draft = { ...draft, components: [...draft.components, comp] }
          return comp
        })
        const markers = clip.markers.map((m) => {
          const mk = { ...m, id: fresh(m.id, m.kind === 'node' ? 'n' : 'j'), position: { x: m.position.x + offset, y: m.position.y + offset }, order: order++ }
          if (m.kind === 'node') mk.label = nextLabel(draft, 'node')
          draft = { ...draft, markers: [...draft.markers, mk] }
          return mk
        })
        const grounds = clip.grounds.map((g) => ({ ...g, id: fresh(g.id, 'g'), position: { x: g.position.x + offset, y: g.position.y + offset }, order: order++ }))
        const wires = clip.wires.map((w) => ({
          id: uid('w'),
          from: { ...w.from, ownerId: map.get(w.from.ownerId)! },
          to: { ...w.to, ownerId: map.get(w.to.ownerId)! },
        }))
        created.push(...components.map((c) => c.id), ...markers.map((m) => m.id), ...grounds.map((g) => g.id))
        return {
          components: [...s.components, ...components],
          markers: [...s.markers, ...markers],
          grounds: [...s.grounds, ...grounds],
          wires: [...s.wires, ...wires],
        }
      })
      return created
    },
  }
})
