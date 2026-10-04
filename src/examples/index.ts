import type { MethodId } from '@/domain/analysis/types'
import { schematicFromGraph, type GraphSpec } from '@/domain/schematic/fromGraph'
import type { Schematic } from '@/domain/schematic/types'

/**
 * Built-in examples. Each one is a graph description laid out as a schematic,
 * with a recommended method/configuration and EXPECTED results. The expected
 * values were derived by hand (or taken from the textbook) and are checked by
 * examples.test.ts against every method.
 */
export interface ExampleExpected {
  /** Node voltage by node label, relative to `referenceLabel`. */
  nodeVoltages?: Record<string, number>
  /** Branch current by element label (passive-sign reference of the example's branch). */
  branchCurrents?: Record<string, number>
  branchVoltages?: Record<string, number>
}

export interface Example {
  id: string
  title: string
  summary: string
  problem: string
  spec: GraphSpec
  method: MethodId
  referenceLabel: string
  /** Element labels of the preset tree (tree methods). */
  treeLabels?: string[]
  expected: ExampleExpected
  source?: string
}

const g = (id: string, x: number, y: number, taps: { x: number; y: number }[] = [], label = 'G') => ({ id, label, x, y, ground: true, taps })

export const EXAMPLES: Example[] = [
  {
    id: 'divider',
    title: 'Simple resistor divider',
    summary: '12 V source across 4 Ω + 2 Ω. One loop, 3 nodes.',
    problem: 'Find the current in the series loop and the voltage across R2 for a 12 V source driving R1 = 4 Ω and R2 = 2 Ω in series.',
    spec: {
      nodes: [
        { id: 'a', label: 'a', x: 0, y: 0 },
        { id: 'b', label: 'b', x: 280, y: 0 },
        g('g', 0, 280, [{ x: 280, y: 280 }]),
      ],
      branches: [
        { label: 'V1', kind: 'voltageSource', value: 12, from: 'a', to: 'g' },
        { label: 'R1', kind: 'resistor', value: 4, from: 'a', to: 'b' },
        { label: 'R2', kind: 'resistor', value: 2, from: 'b', to: 'g' },
      ],
    },
    method: 'nodal',
    referenceLabel: 'G',
    expected: { nodeVoltages: { a: 12, b: 4 }, branchCurrents: { R1: 2, R2: 2, V1: -2 }, branchVoltages: { R2: 4, R1: 8 } },
  },
  {
    id: 'two-loop',
    title: 'Two-loop circuit',
    summary: 'Two voltage sources sharing a resistor. 2 meshes, 4 nodes.',
    problem: 'Find all branch currents. V1 = 10 V, V2 = 6 V, R1 = 2 Ω, R2 = 4 Ω (shared), R3 = 4 Ω.',
    spec: {
      nodes: [
        { id: 'a', label: 'a', x: 0, y: 0 },
        { id: 'b', label: 'b', x: 280, y: 0 },
        { id: 'c', label: 'c', x: 560, y: 0 },
        g('g', 0, 280, [
          { x: 280, y: 280 },
          { x: 560, y: 280 },
        ]),
      ],
      branches: [
        { label: 'V1', kind: 'voltageSource', value: 10, from: 'a', to: 'g' },
        { label: 'R1', kind: 'resistor', value: 2, from: 'a', to: 'b' },
        { label: 'R2', kind: 'resistor', value: 4, from: 'b', to: 'g' },
        { label: 'R3', kind: 'resistor', value: 4, from: 'b', to: 'c' },
        { label: 'V2', kind: 'voltageSource', value: 6, from: 'c', to: 'g' },
      ],
    },
    method: 'loop',
    referenceLabel: 'G',
    treeLabels: ['V1', 'V2', 'R2'],
    expected: { nodeVoltages: { a: 10, b: 6.5, c: 6 }, branchCurrents: { R1: 1.75, R2: 1.625, R3: 0.125, V1: -1.75, V2: 0.125 } },
  },
  {
    id: 'textbook-17-4-1',
    title: 'Three-node network (Example 17.4-1)',
    summary: 'Six resistors and three current sources; textbook nodal-analysis example.',
    problem:
      'Determine the node voltages and the power delivered by each current source (Suresh Kumar, Example 17.4-1). R1 = 0.2 Ω, R2 = 1 Ω, R3 = 0.5 Ω, R4 = 1 Ω, R5 = 0.5 Ω, R6 = 0.2 Ω; I1 = 9 A, I2 = −17 A, I3 = 21 A.',
    spec: {
      nodes: [
        { id: '1', label: '1', x: 0, y: 0, taps: [{ x: -240, y: 0 }, { x: 0, y: -240 }] },
        { id: '2', label: '2', x: 360, y: 0, taps: [{ x: 360, y: -120 }, { x: 360, y: 80 }, { x: 580, y: 80 }] },
        { id: '3', label: '3', x: 720, y: 0, taps: [{ x: 720, y: -120 }, { x: 720, y: -240 }] },
        g(
          'R',
          360,
          360,
          [
            { x: 0, y: 360 },
            { x: -240, y: 360 },
            { x: 580, y: 360 },
            { x: 720, y: 360 },
          ],
          'R',
        ),
      ],
      branches: [
        { label: 'R1', kind: 'resistor', value: 0.2, from: '1', to: 'R', attach: [0, 1] },
        { label: 'R2', kind: 'resistor', value: 1, from: '1', to: '2', attach: [0, 0] },
        { label: 'R3', kind: 'resistor', value: 0.5, from: '3', to: '1', attach: [2, 2] },
        { label: 'R4', kind: 'resistor', value: 1, from: '2', to: 'R', attach: [2, 0], at: { x: 360, y: 220 } },
        { label: 'R5', kind: 'resistor', value: 0.5, from: '3', to: '2', attach: [0, 0] },
        { label: 'R6', kind: 'resistor', value: 0.2, from: '3', to: 'R', attach: [0, 4] },
        { label: 'I1', kind: 'currentSource', value: 9, from: 'R', to: '1', attach: [2, 1] },
        { label: 'I2', kind: 'currentSource', value: -17, from: '2', to: 'R', attach: [3, 3] },
        { label: 'I3', kind: 'currentSource', value: 21, from: '2', to: '3', attach: [1, 1] },
      ],
    },
    method: 'nodal',
    referenceLabel: 'R',
    expected: { nodeVoltages: { '1': 2, '2': 1, '3': 3 }, branchCurrents: { R1: 10, R2: 1, R3: 2, R4: 1, R5: 4, R6: 15, I1: 9, I2: -17, I3: 21 } },
    source: 'K. S. Suresh Kumar, Electric Circuits and Networks, Example 17.4-1',
  },
  {
    id: 'current-source',
    title: 'Current-source network',
    summary: 'Two current sources, three resistors. Ideal for nodal or node-pair analysis.',
    problem: 'I1 = 2 A drives node a; I2 = 1 A is drawn from node b. R1 = 5 Ω, R2 = 3 Ω, R3 = 2 Ω. Find the node voltages.',
    spec: {
      nodes: [
        { id: 'a', label: 'a', x: 0, y: 0 },
        { id: 'b', label: 'b', x: 320, y: 0 },
        g('g', 160, 280, [
          { x: -160, y: 280 },
          { x: 0, y: 280 },
          { x: 320, y: 280 },
          { x: 480, y: 280 },
        ]),
      ],
      branches: [
        { label: 'I1', kind: 'currentSource', value: 2, from: 'g', to: 'a', at: { x: -160, y: 140 } },
        { label: 'R1', kind: 'resistor', value: 5, from: 'a', to: 'g' },
        { label: 'R2', kind: 'resistor', value: 3, from: 'a', to: 'b' },
        { label: 'R3', kind: 'resistor', value: 2, from: 'b', to: 'g' },
        { label: 'I2', kind: 'currentSource', value: 1, from: 'b', to: 'g', at: { x: 480, y: 140 } },
      ],
    },
    method: 'nodePair',
    referenceLabel: 'G',
    treeLabels: ['R1', 'R3'],
    expected: { nodeVoltages: { a: 4, b: 0.4 }, branchCurrents: { R1: 0.8, R2: 1.2, R3: 0.2, I1: 2, I2: 1 } },
  },
  {
    id: 'wheatstone',
    title: 'Multiple spanning-tree network',
    summary: 'Unbalanced Wheatstone bridge: complete graph K₄ with 16 spanning trees.',
    problem:
      'V1 = 10 V feeds a bridge R1 = 2 Ω, R2 = 4 Ω, R3 = 4 Ω, R4 = 2 Ω with R5 = 5 Ω across the middle. Try several spanning trees: the matrices change, the solution does not.',
    spec: {
      nodes: [
        { id: 't', label: 't', x: 280, y: 0 },
        { id: 'l', label: 'l', x: 80, y: 200 },
        { id: 'r', label: 'r', x: 480, y: 200 },
        g('g', 280, 400, [{ x: 680, y: 400 }]),
      ],
      branches: [
        { label: 'V1', kind: 'voltageSource', value: 10, from: 't', to: 'g', at: { x: 680, y: 200 }, rotation: 90 },
        { label: 'R1', kind: 'resistor', value: 2, from: 't', to: 'l', at: { x: 180, y: 100 } },
        { label: 'R2', kind: 'resistor', value: 4, from: 't', to: 'r', at: { x: 380, y: 100 } },
        { label: 'R3', kind: 'resistor', value: 4, from: 'l', to: 'g', at: { x: 180, y: 300 } },
        { label: 'R4', kind: 'resistor', value: 2, from: 'r', to: 'g', at: { x: 380, y: 300 } },
        { label: 'R5', kind: 'resistor', value: 5, from: 'l', to: 'r' },
      ],
    },
    method: 'loop',
    referenceLabel: 'G',
    treeLabels: ['V1', 'R1', 'R2'],
    expected: {
      nodeVoltages: { t: 10, l: 140 / 23, r: 90 / 23 },
      branchCurrents: { R5: 10 / 23, R1: (10 - 140 / 23) / 2, R4: 45 / 23 },
    },
  },
  {
    id: 'bf-demo',
    title: 'Bf demonstration (Example 17.7-1)',
    summary: 'Four voltage sources, five resistors, 7 nodes. Textbook loop-analysis example.',
    problem:
      'Find the power delivered by each voltage source (Suresh Kumar, Example 17.7-1). Use the tree {V1, V2, V3, V4, R2, R4}; the links R1, R3, R5 define three f-circuits.',
    spec: {
      nodes: [
        { id: 'T1', label: 'T1', x: 0, y: 0 },
        { id: 'M', label: 'M', x: 280, y: 0 },
        { id: 'T2', label: 'T2', x: 280, y: 200 },
        { id: 'K', label: 'K', x: 560, y: 0 },
        { id: 'T3', label: 'T3', x: 560, y: 200 },
        { id: 'T4', label: 'T4', x: 840, y: 0 },
        g('G', 420, 440, [
          { x: 0, y: 440 },
          { x: 280, y: 440 },
          { x: 560, y: 440 },
          { x: 840, y: 440 },
        ]),
      ],
      branches: [
        { label: 'V1', kind: 'voltageSource', value: 5, from: 'G', to: 'T1' },
        { label: 'V2', kind: 'voltageSource', value: 6, from: 'G', to: 'T2', at: { x: 280, y: 320 } },
        { label: 'V3', kind: 'voltageSource', value: 2, from: 'G', to: 'T3', at: { x: 560, y: 320 } },
        { label: 'V4', kind: 'voltageSource', value: -11, from: 'G', to: 'T4' },
        { label: 'R1', kind: 'resistor', value: 2, from: 'M', to: 'T1' },
        { label: 'R2', kind: 'resistor', value: 3, from: 'M', to: 'T2' },
        { label: 'R3', kind: 'resistor', value: 1, from: 'K', to: 'M' },
        { label: 'R4', kind: 'resistor', value: 1, from: 'K', to: 'T3' },
        { label: 'R5', kind: 'resistor', value: 4, from: 'T4', to: 'K' },
      ],
    },
    method: 'fcircuit',
    referenceLabel: 'G',
    treeLabels: ['V1', 'V2', 'V3', 'V4', 'R2', 'R4'],
    expected: { branchCurrents: { R1: 1, R3: 2, R5: 3, V1: -1, V2: -1, V3: -1, V4: 3 } },
    source: 'K. S. Suresh Kumar, Electric Circuits and Networks, Example 17.7-1',
  },
  {
    id: 'qf-demo',
    title: 'Qf demonstration',
    summary: 'Ladder with a current source and a voltage source; f-cut-sets of a chosen tree.',
    problem: 'I1 = 4 A, V1 = 1 V, R1 = 2 Ω, R2 = 1 Ω, R3 = 2 Ω, R4 = 1 Ω. Use the tree {R2, R3, V1} and form the f-cut-set matrix Qf.',
    spec: {
      nodes: [
        { id: '1', label: '1', x: 0, y: 0 },
        { id: '2', label: '2', x: 280, y: 0 },
        { id: '3', label: '3', x: 560, y: 0 },
        g('g', 0, 280, [
          { x: -200, y: 280 },
          { x: 280, y: 280 },
          { x: 560, y: 280 },
        ]),
      ],
      branches: [
        { label: 'I1', kind: 'currentSource', value: 4, from: 'g', to: '1', at: { x: -200, y: 140 } },
        { label: 'R1', kind: 'resistor', value: 2, from: '1', to: 'g' },
        { label: 'R2', kind: 'resistor', value: 1, from: '1', to: '2' },
        { label: 'R3', kind: 'resistor', value: 2, from: '2', to: 'g' },
        { label: 'R4', kind: 'resistor', value: 1, from: '2', to: '3' },
        { label: 'V1', kind: 'voltageSource', value: 1, from: '3', to: 'g' },
      ],
    },
    method: 'fcutset',
    referenceLabel: 'G',
    treeLabels: ['R2', 'R3', 'V1'],
    expected: { nodeVoltages: { '1': 4, '2': 2, '3': 1 }, branchCurrents: { R1: 2, R2: 2, R3: 1, R4: 1, V1: 1, I1: 4 } },
  },
]

export function exampleSchematic(ex: Example): Schematic {
  return schematicFromGraph(ex.spec, `${ex.id.replace(/[^a-z0-9]/gi, '')}`)
}
