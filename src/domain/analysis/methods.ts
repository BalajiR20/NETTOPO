import type { MethodId, MethodInfo } from './types'

export const METHODS: Record<MethodId, MethodInfo> = {
  incidence: {
    id: 'incidence',
    title: 'Incidence Matrix A',
    short: 'A',
    description:
      'Builds the all-incidence matrix Aₐ and the reduced incidence matrix A, then solves KCL (A i = 0), the node transformation (v = Aᵀvₙ) and the element relations together.',
    requiresReference: true,
    requiresTree: false,
    section: '§17.2–17.3',
    unknownsLatex: 'v_n,\\ v,\\ i',
    coreEquation: 'A\\,i = 0,\\quad v = A^{T} v_n',
  },
  nodal: {
    id: 'nodal',
    title: 'Nodal Analysis',
    short: 'Nodal',
    description:
      'Eliminates branch variables to obtain the nodal admittance equation Yₙ vₙ = A(i_g − Y_p v_g) in the node voltages.',
    requiresReference: true,
    requiresTree: false,
    section: '§17.4, §17.11.1',
    unknownsLatex: 'v_n',
    coreEquation: 'A Y_p A^{T} v_n = A\\left(i_g - Y_p v_g\\right)',
  },
  fcircuit: {
    id: 'fcircuit',
    title: 'Fundamental Circuit Matrix Bf',
    short: 'Bf',
    description:
      'For a chosen spanning tree, forms one f-circuit per link and the matrix Bf. It then solves KVL (Bf v = 0), the link-current relation (i = Bfᵀ iₗ) and the element relations together.',
    requiresReference: false,
    requiresTree: true,
    section: '§17.5–17.6',
    unknownsLatex: 'i_l,\\ v,\\ i',
    coreEquation: 'B_f\\,v = 0,\\quad i = B_f^{T} i_l',
  },
  loop: {
    id: 'loop',
    title: 'Loop Analysis',
    short: 'Loop',
    description:
      'Uses the f-circuits of a chosen tree to obtain the loop impedance equation Z_L iₗ = Bf(v_g − Z_p i_g) in the link (loop) currents.',
    requiresReference: false,
    requiresTree: true,
    section: '§17.7, §17.11.2',
    unknownsLatex: 'i_l',
    coreEquation: 'B_f Z_p B_f^{T} i_l = B_f\\left(v_g - Z_p i_g\\right)',
  },
  fcutset: {
    id: 'fcutset',
    title: 'Fundamental Cut-Set Matrix Qf',
    short: 'Qf',
    description:
      'For a chosen spanning tree, forms one f-cut-set per twig and the matrix Qf. It then solves KCL (Qf i = 0), the twig-voltage relation (v = Qfᵀ vₜ) and the element relations together.',
    requiresReference: false,
    requiresTree: true,
    section: '§17.8–17.9',
    unknownsLatex: 'v_t,\\ v,\\ i',
    coreEquation: 'Q_f\\,i = 0,\\quad v = Q_f^{T} v_t',
  },
  nodePair: {
    id: 'nodePair',
    title: 'Node-Pair Analysis',
    short: 'Node-pair',
    description:
      'Uses the f-cut-sets of a chosen tree to obtain the node-pair admittance equation Yₜ vₜ = Qf(i_g − Y_p v_g) in the twig (node-pair) voltages.',
    requiresReference: false,
    requiresTree: true,
    section: '§17.10, §17.11.3',
    unknownsLatex: 'v_t',
    coreEquation: 'Q_f Y_p Q_f^{T} v_t = Q_f\\left(i_g - Y_p v_g\\right)',
  },
}

export const METHOD_ORDER: MethodId[] = ['incidence', 'nodal', 'fcircuit', 'loop', 'fcutset', 'nodePair']
