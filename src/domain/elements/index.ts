import { z } from 'zod'

/**
 * Element kinds supported by the initial (DC, linear, resistive) release.
 * The union is deliberately open for capacitor / inductor / dependent sources.
 */
export const ELEMENT_KINDS = ['resistor', 'voltageSource', 'currentSource'] as const
export type ElementKind = (typeof ELEMENT_KINDS)[number]

export interface ElementBase {
  id: string
  type: ElementKind
  /** SI value: Ω for resistors, V for voltage sources, A for current sources. */
  value: number
  parameters: Record<string, number | string | boolean>
}

export interface ResistorElement extends ElementBase {
  type: 'resistor'
}
/** Pin a is the + terminal: V(a) − V(b) = value. */
export interface VoltageSourceElement extends ElementBase {
  type: 'voltageSource'
}
/** Arrow from pin a to pin b inside the source: drives `value` out of pin b. */
export interface CurrentSourceElement extends ElementBase {
  type: 'currentSource'
}

export type Element = ResistorElement | VoltageSourceElement | CurrentSourceElement

export interface ElementDescriptor {
  kind: ElementKind
  name: string
  symbolLetter: string
  unit: string
  quantity: string
  defaultValue: number
  /** Human-readable meaning of the value and its polarity. */
  polarityNote: string
  validate(value: number): string | null
}

const finite = (v: number) => (Number.isFinite(v) ? null : 'Value must be a finite number.')

export const ELEMENT_DESCRIPTORS: Record<ElementKind, ElementDescriptor> = {
  resistor: {
    kind: 'resistor',
    name: 'Resistor',
    symbolLetter: 'R',
    unit: 'Ω',
    quantity: 'Resistance',
    defaultValue: 10,
    polarityNote: 'Passive element: vₖ = R·iₖ (passive sign convention).',
    validate: (v) =>
      finite(v) ??
      (v <= 0
        ? 'Resistance must be greater than 0 Ω. Use a wire for a short circuit; delete the resistor for an open circuit.'
        : null),
  },
  voltageSource: {
    kind: 'voltageSource',
    name: 'Voltage Source',
    symbolLetter: 'V',
    unit: 'V',
    quantity: 'EMF',
    defaultValue: 10,
    polarityNote: 'Pin a is the + terminal: V(a) − V(b) = E.',
    validate: finite,
  },
  currentSource: {
    kind: 'currentSource',
    name: 'Current Source',
    symbolLetter: 'I',
    unit: 'A',
    quantity: 'Current',
    defaultValue: 1,
    polarityNote: 'Arrow a → b inside the source: I leaves through pin b.',
    validate: finite,
  },
}

export const elementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ELEMENT_KINDS),
  value: z.number().finite(),
  parameters: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
})

export function validateElementValue(kind: ElementKind, value: number): string | null {
  return ELEMENT_DESCRIPTORS[kind].validate(value)
}
