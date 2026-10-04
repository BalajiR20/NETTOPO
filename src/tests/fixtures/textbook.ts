import type { GraphSpec } from '@/domain/schematic/fromGraph'

/**
 * Textbook fixtures reconstructed from K. S. Suresh Kumar, Chapter 17.
 * Branch order = textbook branch numbering, so b_k here is "Branch-k" in the book.
 */

/** Fig. 17.2-1: 6 nodes, 8 branches (orientation read off the printed Aa). Elements are placeholders. */
export const fig17_2_1: GraphSpec = {
  nodes: [
    { id: '1', label: '1', x: 0, y: 0 },
    { id: '2', label: '2', x: 200, y: 0 },
    { id: '3', label: '3', x: 200, y: 200 },
    { id: '4', label: '4', x: -200, y: 200 },
    { id: '5', label: '5', x: 200, y: 400 },
    { id: '6', label: '6', x: 400, y: 400 },
  ],
  branches: [
    { label: 'R1', kind: 'resistor', value: 1, from: '4', to: '1' },
    { label: 'R2', kind: 'resistor', value: 1, from: '2', to: '6' },
    { label: 'R3', kind: 'resistor', value: 1, from: '3', to: '5' },
    { label: 'R4', kind: 'resistor', value: 1, from: '1', to: '3' },
    { label: 'R5', kind: 'resistor', value: 1, from: '1', to: '2' },
    { label: 'R6', kind: 'resistor', value: 1, from: '2', to: '3' },
    { label: 'R7', kind: 'resistor', value: 1, from: '6', to: '4' },
    { label: 'R8', kind: 'resistor', value: 1, from: '6', to: '5' },
  ],
}

/** Printed Aa of Fig. 17.2-1 (rows nodes 1..6, columns branches 1..8). */
export const fig17_2_1_Aa = [
  [-1, 0, 0, 1, 1, 0, 0, 0],
  [0, 1, 0, 0, -1, 1, 0, 0],
  [0, 0, 1, -1, 0, -1, 0, 0],
  [1, 0, 0, 0, 0, 0, -1, 0],
  [0, 0, -1, 0, 0, 0, 0, -1],
  [0, -1, 0, 0, 0, 0, 1, 1],
]

/**
 * Example 17.4-1 (Fig. 17.4-2). Branches 1–6 resistors, 7–9 current sources whose
 * values are the branch currents under the passive sign convention (Ig).
 * Node R (reference) is grounded. Expected: Vn = [2, 1, 3] V; source powers
 * delivered 18 W, 17 W, 42 W.
 */
export const example17_4_1: GraphSpec = {
  nodes: [
    { id: '1', label: '1', x: 0, y: 0 },
    { id: '2', label: '2', x: 300, y: 0 },
    { id: '3', label: '3', x: 600, y: 0 },
    { id: 'R', label: 'R', x: 300, y: 300, ground: true },
  ],
  branches: [
    { label: 'R1', kind: 'resistor', value: 0.2, from: '1', to: 'R' },
    { label: 'R2', kind: 'resistor', value: 1, from: '1', to: '2' },
    { label: 'R3', kind: 'resistor', value: 0.5, from: '3', to: '1' },
    { label: 'R4', kind: 'resistor', value: 1, from: '2', to: 'R' },
    { label: 'R5', kind: 'resistor', value: 0.5, from: '3', to: '2' },
    { label: 'R6', kind: 'resistor', value: 0.2, from: '3', to: 'R' },
    { label: 'I1', kind: 'currentSource', value: 9, from: 'R', to: '1' },
    { label: 'I2', kind: 'currentSource', value: -17, from: '2', to: 'R' },
    { label: 'I3', kind: 'currentSource', value: 21, from: '2', to: '3' },
  ],
}

/**
 * Example 17.7-1 (Fig. 17.7-2). Branches 1–4 voltage sources (branch voltages
 * Vg = [5, 6, 2, −11] V), branches 5–9 resistors. Graph reconstructed from the
 * printed Bf for the tree {1, 2, 3, 4, 6, 8}. Expected: I_l = [1, 2, 3] A,
 * I_g = [−1, −1, −1, 3] A.
 */
export const example17_7_1: GraphSpec = {
  nodes: [
    { id: 'T1', label: 'T1', x: 0, y: 0 },
    { id: 'M', label: 'M', x: 200, y: 0 },
    { id: 'T2', label: 'T2', x: 200, y: 200 },
    { id: 'K', label: 'K', x: 400, y: 0 },
    { id: 'T3', label: 'T3', x: 400, y: 200 },
    { id: 'T4', label: 'T4', x: 600, y: 0 },
    { id: 'G', label: 'G', x: 300, y: 400, ground: true },
  ],
  branches: [
    { label: 'V1', kind: 'voltageSource', value: 5, from: 'G', to: 'T1' },
    { label: 'V2', kind: 'voltageSource', value: 6, from: 'G', to: 'T2' },
    { label: 'V3', kind: 'voltageSource', value: 2, from: 'G', to: 'T3' },
    { label: 'V4', kind: 'voltageSource', value: -11, from: 'G', to: 'T4' },
    { label: 'R1', kind: 'resistor', value: 2, from: 'M', to: 'T1' },
    { label: 'R2', kind: 'resistor', value: 3, from: 'M', to: 'T2' },
    { label: 'R3', kind: 'resistor', value: 1, from: 'K', to: 'M' },
    { label: 'R4', kind: 'resistor', value: 1, from: 'K', to: 'T3' },
    { label: 'R5', kind: 'resistor', value: 4, from: 'T4', to: 'K' },
  ],
}

/** Printed Bf of Example 17.7-1 in natural branch order (rows: links 5, 7, 9). */
export const example17_7_1_Bf = [
  [-1, 1, 0, 0, 1, -1, 0, 0, 0],
  [0, -1, 1, 0, 0, 1, 1, -1, 0],
  [0, 0, -1, 1, 0, 0, 0, 1, 1],
]

/** Simple divider: 12 V across 4 Ω + 2 Ω. */
export const divider: GraphSpec = {
  nodes: [
    { id: 'a', label: 'a', x: 0, y: 0 },
    { id: 'b', label: 'b', x: 200, y: 0 },
    { id: 'g', label: 'g', x: 100, y: 200, ground: true },
  ],
  branches: [
    { label: 'V1', kind: 'voltageSource', value: 12, from: 'a', to: 'g' },
    { label: 'R1', kind: 'resistor', value: 4, from: 'a', to: 'b' },
    { label: 'R2', kind: 'resistor', value: 2, from: 'b', to: 'g' },
  ],
}

/** Mixed sources with a zero-current branch (balanced bridge). */
export const bridge: GraphSpec = {
  nodes: [
    { id: 't', label: 't', x: 200, y: 0 },
    { id: 'l', label: 'l', x: 0, y: 200 },
    { id: 'r', label: 'r', x: 400, y: 200 },
    { id: 'g', label: 'g', x: 200, y: 400, ground: true },
  ],
  branches: [
    { label: 'V1', kind: 'voltageSource', value: 10, from: 't', to: 'g', at: { x: 600, y: 200 }, rotation: 90 },
    { label: 'R1', kind: 'resistor', value: 2, from: 't', to: 'l' },
    { label: 'R2', kind: 'resistor', value: 4, from: 't', to: 'r' },
    { label: 'R3', kind: 'resistor', value: 1, from: 'l', to: 'g' },
    { label: 'R4', kind: 'resistor', value: 2, from: 'r', to: 'g' },
    { label: 'R5', kind: 'resistor', value: 5, from: 'l', to: 'r' },
    { label: 'I1', kind: 'currentSource', value: 0, from: 'g', to: 'l', at: { x: -200, y: 300 }, rotation: 270 },
  ],
}
