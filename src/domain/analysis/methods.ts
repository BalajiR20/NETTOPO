import type { MethodId, MethodInfo } from './types'

export const METHODS: Record<MethodId, MethodInfo> = {
  incidence: {
    id: 'incidence',
    title: 'Incidence Matrix A',
    short: 'A',
    description:
      'Builds Aₐ and the reduced incidence matrix A, partitions it into passive and source columns, forms Yₙ = Aₚ Yₚ Aₚᵀ and solves Vₙ = −Yₙ⁻¹ A_g I_g (§17.4), then recovers V = AᵀVₙ and Iₚ = Yₚ Vₚ.',
    requiresReference: true,
    requiresTree: false,
    section: '§17.2–17.4',
    unknownsLatex: 'v_n',
    coreEquation: 'A_p Y_p A_p^{T} V_n = -A_g I_g',
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
      'For a chosen spanning tree, forms the f-circuits and Bf, partitions it into voltage-source and passive columns, forms Z_L = B_fp Zₚ B_fpᵀ and solves Iₗ = −Z_L⁻¹ B_fg V_g (§17.7), then recovers I = BfᵀIₗ and Vₚ = Zₚ Iₚ.',
    requiresReference: false,
    requiresTree: true,
    section: '§17.5–17.7',
    unknownsLatex: 'i_l',
    coreEquation: 'B_{fp} Z_p B_{fp}^{T} I_l = -B_{fg} V_g',
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
      'For a chosen spanning tree, forms the f-cut-sets and Qf, partitions it into current-source and passive columns, forms Yₜ = Q_fp Yₚ Q_fpᵀ and solves Vₜ = −Yₜ⁻¹ Q_fg I_g (§17.10), then recovers V = QfᵀVₜ and Iₚ = Yₚ Vₚ.',
    requiresReference: false,
    requiresTree: true,
    section: '§17.8–17.10',
    unknownsLatex: 'v_t',
    coreEquation: 'Q_{fp} Y_p Q_{fp}^{T} V_t = -Q_{fg} I_g',
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
