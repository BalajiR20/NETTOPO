import type { AnalysisConfig, AnalysisOutcome } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import { solvePartitioned } from '../common/partitioned'

/**
 * Fundamental-cut-set-matrix method (§17.9–17.10), textbook procedure:
 *   1. choose a spanning tree, form the f-cut-sets and Qf
 *   2. partition Qf = [Q_fg  Q_fp]       (current sources | passive)
 *   3. KCL  Qf i = 0,  twig-voltage relation  v = Qfᵀ vₜ
 *   4. Iₚ = Yₚ Vₚ  →  Yₜ = Q_fp Yₚ Q_fpᵀ
 *   5. Vₜ = −Yₜ⁻¹ Q_fg I_g               (17.10-6)
 *   6. V = QfᵀVₜ,  Iₚ = Yₚ Vₚ
 * Ideal voltage sources are carried by an extra partition Q_fv
 * (implementation detail replacing the book's v-shift).
 */
export function solveFundamentalCutSet(net: Network, config: AnalysisConfig): AnalysisOutcome {
  return solvePartitioned(net, config, 'fcutset')
}
