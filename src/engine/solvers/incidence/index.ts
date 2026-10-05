import type { AnalysisConfig, AnalysisOutcome } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import { solvePartitioned } from '../common/partitioned'

/**
 * Incidence-matrix method (§17.3–17.4), textbook procedure:
 *   1. build Aₐ, drop the reference row → A
 *   2. partition A = [Aₚ  A_g]           (passive | current sources)
 *   3. KCL  A i = 0,  node transformation  v = Aᵀvₙ
 *   4. Iₚ = Yₚ Vₚ  →  Yₙ = Aₚ Yₚ Aₚᵀ
 *   5. Vₙ = −Yₙ⁻¹ A_g I_g   (17.4-4)
 *   6. V = AᵀVₙ,  Iₚ = Yₚ Vₚ
 * No tree is required. Ideal voltage sources are carried by an extra
 * partition A_v (implementation detail replacing the book's v-shift).
 */
export function solveIncidence(net: Network, config: AnalysisConfig): AnalysisOutcome {
  return solvePartitioned(net, config, 'incidence')
}
