import type { MethodId } from '@/domain/analysis/types'

/**
 * Explanation engine: concise, technically correct "WHY?" texts tied to
 * Chapter 17. Kept separate from solvers so wording can evolve without
 * touching the mathematics.
 */
export const WHY = {
  nodes:
    'Every point where element terminals are joined by wires is one node: one "bubble" of the linear graph (§17.1). Wires carry no element, so they collapse into nodes.',
  branches:
    'Each two-terminal element becomes one branch. Topological equations do not depend on what the element is, only on how the branches are interconnected (§17.1).',
  orientation:
    'The branch arrow is the reference direction of the branch current iₖ. The voltage vₖ follows the passive sign convention, + at the node the arrow leaves. A negative result only means the actual direction is opposite to the reference.',
  reference:
    'The rows of Aₐ sum to zero, so one KCL equation is always redundant. Dropping the reference node row leaves n − 1 independent equations, and node voltages are measured from this node (§17.2, §17.3.2).',
  treeNeeded:
    'Fundamental circuits and fundamental cut-sets are defined relative to a selected spanning tree. Each link closes exactly one f-circuit, and each twig defines exactly one f-cut-set (§17.5, §17.8.4).',
  treeChoice:
    'Any tree gives b − n + 1 independent KVL equations (or n − 1 independent KCL equations). Different trees give different Bf / Qf matrices but the same physical solution.',
  incidenceEntry:
    '+1 means the branch is incident at the node and oriented away from it; −1 means oriented towards it. Each column has exactly one +1 and one −1 because a branch has two ends.',
  kclA:
    'Row i of A multiplied by the branch current vector is the sum of currents leaving node i, so A i = 0 is KCL at every node except the reference (17.3-1).',
  nodeTransformation:
    'For branch k between nodes p and q, KVL in the loop (reference → p → branch k → q → reference) gives vₖ = vₙ,p − vₙ,q. The signs of column k of A supply exactly these coefficients, so v = Aᵀ vₙ (17.3-3).',
  fcircuit:
    'Adding a link to the tree creates exactly one loop. Its traversal direction is chosen to agree with the link, so the link enters its own row with +1 and Bf = [B_ft | U] (§17.5.1).',
  kvlBf:
    'Each row of Bf lists the branches of one f-circuit with ±1 for agreement with the traversal, so Bf v = 0 is KVL around every f-circuit (17.6-2). These b − n + 1 equations are independent.',
  linkCurrents:
    'KCL lets every twig current be written in terms of link currents, i = Bfᵀ iₗ (17.6-3). The link currents are therefore a complete set of loop currents.',
  fcutset:
    'Removing one twig splits the tree into two node groups. The twig plus the links joining the groups is the f-cut-set, oriented to agree with the twig, so Qf = [U | Q_fl] (§17.8.4).',
  kclQf:
    'The net current crossing any cut-set is zero, so Qf i = 0 is KCL for each f-cut-set (17.10-1). These are linear combinations of node KCL equations.',
  twigVoltages:
    'KVL lets every link voltage be written in terms of twig voltages, v = Qfᵀ vₜ (17.10-2). Twig voltages are voltages between node pairs, hence "node-pair" analysis.',
  elementRelations:
    'Kirchhoff’s laws involve only topology. The element relations (generalised branch model, §17.11) supply the remaining b equations that make the system square.',
  idealSourcesNodal:
    'An ideal voltage source has no finite admittance, so it cannot enter Yₚ. NETTOPO keeps its current as an extra unknown and adds the constraint vₖ = sE. This is equivalent to the textbook’s v-shift (§17.4.1) without editing the circuit.',
  idealSourcesLoop:
    'An ideal current source has no finite impedance, so it cannot enter Zₚ. NETTOPO keeps its voltage as an extra unknown and adds the constraint iₖ = sI. This is equivalent to the textbook’s i-shift (§17.7.1) without editing the circuit.',
  solve:
    'The equations are linear with constant coefficients, so they form a square linear system M x = r. It is solved with LU factorisation with partial pivoting (math.js) after a rank check.',
  verify:
    'The solution is substituted back into KCL, KVL, the element relations and Tellegen’s theorem. A residual near machine precision confirms that the mathematics is self-consistent.',
  tellegen:
    'Tellegen’s theorem (§17.12) follows from v = Aᵀvₙ and A i = 0: vᵀi = vₙᵀ(A i) = 0. It holds for any network that satisfies KCL and KVL.',
  visualize:
    'Branch currents and voltages are drawn on the circuit in their reference directions. A negative value means the actual direction opposes the branch arrow.',
} as const

export const METHOD_WHY: Record<MethodId, string> = {
  incidence:
    'The incidence matrix encodes the complete structure of the graph. KCL comes out of A directly. KVL needs the node-voltage variables, through v = Aᵀvₙ.',
  nodal:
    'Substituting the element relations and v = Aᵀvₙ into A i = 0 leaves only the n − 1 node voltages as unknowns. Nodal analysis does not need a tree.',
  fcircuit:
    'Bf encodes an independent set of loops. With i = Bfᵀ iₗ, KCL is automatically satisfied and KVL is written once per f-circuit.',
  loop:
    'Substituting the element relations and i = Bfᵀ iₗ into Bf v = 0 leaves only the b − n + 1 link currents as unknowns.',
  fcutset:
    'Qf encodes an independent set of cut-sets. With v = Qfᵀ vₜ, KVL is automatically satisfied and KCL is written once per f-cut-set.',
  nodePair:
    'Substituting the element relations and v = Qfᵀ vₜ into Qf i = 0 leaves only the n − 1 twig voltages as unknowns.',
}
