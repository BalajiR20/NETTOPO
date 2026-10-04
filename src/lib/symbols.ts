import type { ElementKind } from '@/domain/elements'

/**
 * Circuit symbol geometry shared by the React canvas and the SVG/PDF renderer.
 * Local coordinates: pin a at (−40, 0), pin b at (+40, 0), body centred at 0.
 */
export const SYMBOL_PATHS: Record<ElementKind, { stroke: string; fill?: string; circle?: { r: number } }> = {
  // ANSI zig-zag resistor
  resistor: {
    stroke: 'M -40 0 L -24 0 L -20 -8 L -12 8 L -4 -8 L 4 8 L 12 -8 L 20 8 L 24 0 L 40 0',
  },
  // Independent voltage source: circle with + at pin a (left) and − at pin b (right)
  voltageSource: {
    stroke: 'M -40 0 L -15 0 M 15 0 L 40 0 M -9 -4 L -9 4 M -13 0 L -5 0 M 5 0 L 12 0',
    circle: { r: 15 },
  },
  // Independent current source: circle with arrow from pin a to pin b
  currentSource: {
    stroke: 'M -40 0 L -15 0 M 15 0 L 40 0 M -8 0 L 8 0',
    fill: 'M 8 0 L 2 -5 L 2 5 Z',
    circle: { r: 15 },
  },
}

/** Ground symbol, pin at (0, −20). */
export const GROUND_PATH = 'M 0 -20 L 0 0 M -14 0 L 14 0 M -9 6 L 9 6 M -4 12 L 4 12'

/** Branch orientation arrow drawn beside the symbol (from pin a side to pin b side). */
export const ORIENTATION_ARROW = { line: 'M -14 0 L 12 0', head: 'M 14 0 L 8 -4 L 8 4 Z' }
