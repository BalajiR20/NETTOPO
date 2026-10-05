import type { AnalysisConfig, AnalysisOutcome } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import { solvePartitioned } from '../common/partitioned'

/**
 * Fundamental-circuit-matrix method (§17.6–17.7), textbook procedure:
 *   1. choose a spanning tree, form the f-circuits and Bf
 *   2. partition Bf = [B_fg  B_fp]       (voltage sources | passive)
 *   3. KVL  Bf v = 0,  link-current relation  i = Bfᵀ iₗ
 *   4. Vₚ = Zₚ Iₚ  →  Z_L = B_fp Zₚ B_fpᵀ
 *   5. Iₗ = −Z_L⁻¹ B_fg V_g              (17.7-7)
 *   6. I = BfᵀIₗ,  Vₚ = Zₚ Iₚ
 * Ideal current sources are carried by an extra partition B_fi
 * (implementation detail replacing the book's i-shift).
 */
export function solveFundamentalCircuit(net: Network, config: AnalysisConfig): AnalysisOutcome {
  return solvePartitioned(net, config, 'fcircuit')
}
