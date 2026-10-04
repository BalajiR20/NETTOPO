import type { Point } from '@/domain/schematic/types'

/** Minimal bridge so toolbar buttons can place items at the visible centre of the canvas. */
export const canvasApi: {
  center: () => Point
  fitView: () => void
  zoomIn: () => void
  zoomOut: () => void
  /** Returns a PNG data URL of the circuit area, or null. */
  element: () => HTMLElement | null
} = {
  center: () => ({ x: 0, y: 0 }),
  fitView: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
  element: () => null,
}

export const DRAG_MIME = 'application/x-nettopo-item'
