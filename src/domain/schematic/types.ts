import { z } from 'zod'
import { ELEMENT_KINDS, type ElementKind } from '@/domain/elements'

/**
 * The schematic is the editable document: what the user draws. The
 * mathematical network (oriented graph) is DERIVED from it by
 * `deriveNetwork()`; positions here never influence the mathematics.
 */

export type Rotation = 0 | 90 | 180 | 270

export interface Point {
  x: number
  y: number
}

export interface SchematicComponent {
  id: string
  kind: ElementKind
  /** Element label, e.g. R1, V1, I1. */
  label: string
  /** SI value. */
  value: number
  position: Point
  rotation: Rotation
  /** Branch orientation reversed relative to the default pin a → pin b. */
  reversed: boolean
  /** Creation sequence; determines branch numbering b1…bb. */
  order: number
}

export type MarkerKind = 'node' | 'junction'

export interface SchematicMarker {
  id: string
  kind: MarkerKind
  label: string
  position: Point
  order: number
}

export interface SchematicGround {
  id: string
  position: Point
  order: number
}

export type PinId = 'a' | 'b' | 'p'

export interface PinRef {
  ownerId: string
  pin: PinId
}

export interface Wire {
  id: string
  from: PinRef
  to: PinRef
}

export interface Schematic {
  components: SchematicComponent[]
  markers: SchematicMarker[]
  grounds: SchematicGround[]
  wires: Wire[]
}

export const emptySchematic = (): Schematic => ({ components: [], markers: [], grounds: [], wires: [] })

export const pinKey = (p: PinRef) => `${p.ownerId}:${p.pin}`

/* ----------------------------- Zod schemas ----------------------------- */

const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() })
const rotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])

export const componentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(ELEMENT_KINDS),
  label: z.string().max(40),
  value: z.number().finite(),
  position: pointSchema,
  rotation: rotationSchema,
  reversed: z.boolean(),
  order: z.number().int().nonnegative(),
})

export const markerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['node', 'junction']),
  label: z.string().max(40),
  position: pointSchema,
  order: z.number().int().nonnegative(),
})

export const groundSchema = z.object({
  id: z.string().min(1),
  position: pointSchema,
  order: z.number().int().nonnegative(),
})

const pinRefSchema = z.object({ ownerId: z.string().min(1), pin: z.enum(['a', 'b', 'p']) })

export const wireSchema = z.object({ id: z.string().min(1), from: pinRefSchema, to: pinRefSchema })

export const schematicSchema = z
  .object({
    components: z.array(componentSchema),
    markers: z.array(markerSchema),
    grounds: z.array(groundSchema),
    wires: z.array(wireSchema),
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>()
    const owners = new Map<string, 'component' | 'single'>()
    for (const c of s.components) owners.set(c.id, 'component')
    for (const m of s.markers) owners.set(m.id, 'single')
    for (const g of s.grounds) owners.set(g.id, 'single')
    for (const item of [...s.components, ...s.markers, ...s.grounds, ...s.wires]) {
      if (ids.has(item.id)) ctx.addIssue({ code: 'custom', message: `Duplicate id "${item.id}".` })
      ids.add(item.id)
    }
    for (const w of s.wires) {
      for (const end of [w.from, w.to]) {
        const owner = owners.get(end.ownerId)
        if (!owner) {
          ctx.addIssue({ code: 'custom', message: `Wire ${w.id} references unknown item "${end.ownerId}".` })
        } else if (owner === 'component' && end.pin === 'p') {
          ctx.addIssue({ code: 'custom', message: `Wire ${w.id} uses pin "p" on a component.` })
        } else if (owner === 'single' && end.pin !== 'p') {
          ctx.addIssue({ code: 'custom', message: `Wire ${w.id} uses pin "${end.pin}" on a node/ground.` })
        }
      }
    }
  })
