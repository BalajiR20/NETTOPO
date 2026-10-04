import type { PinId, Point, Rotation, Schematic, SchematicComponent } from './types'

/**
 * Schematic geometry. All positions are CENTRES (the canvas uses nodeOrigin [0.5, 0.5]).
 * Geometry is used only for drawing; it never influences the mathematics.
 */
export const GRID = 20
export const COMPONENT_LENGTH = 80
export const COMPONENT_THICKNESS = 40
export const GROUND_SIZE = 40

export function componentSize(rotation: Rotation): { width: number; height: number } {
  return rotation === 0 || rotation === 180
    ? { width: COMPONENT_LENGTH, height: COMPONENT_THICKNESS }
    : { width: COMPONENT_THICKNESS, height: COMPONENT_LENGTH }
}

/** Unit vector pointing from the component centre towards pin a. */
export function pinADirection(rotation: Rotation): Point {
  switch (rotation) {
    case 0:
      return { x: -1, y: 0 }
    case 90:
      return { x: 0, y: -1 }
    case 180:
      return { x: 1, y: 0 }
    case 270:
      return { x: 0, y: 1 }
  }
}

export function componentPinPosition(c: Pick<SchematicComponent, 'position' | 'rotation'>, pin: 'a' | 'b'): Point {
  const d = pinADirection(c.rotation)
  const s = pin === 'a' ? 1 : -1
  const half = COMPONENT_LENGTH / 2
  return { x: c.position.x + s * d.x * half, y: c.position.y + s * d.y * half }
}

export function pinPosition(s: Schematic, ownerId: string, pin: PinId): Point | null {
  const c = s.components.find((x) => x.id === ownerId)
  if (c && (pin === 'a' || pin === 'b')) return componentPinPosition(c, pin)
  const m = s.markers.find((x) => x.id === ownerId)
  if (m) return { ...m.position }
  const g = s.grounds.find((x) => x.id === ownerId)
  if (g) return { x: g.position.x, y: g.position.y - GROUND_SIZE / 2 }
  return null
}

export const snap = (v: number, grid = GRID) => Math.round(v / grid) * grid

export const nextRotation = (r: Rotation): Rotation => (((r + 90) % 360) as Rotation)
