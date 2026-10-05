# NETTOPO — Solvers

`engine/solvers/index.ts → runAnalysis(method, network, config)` dispatches
to exactly one solver. Every solver:

1. runs **preflight**: structural errors, well-posedness (§17.3.1/§17.6.1), and the
   required reference node or valid tree;
2. adds the identification steps (nodes, branches, orientations);
3. builds **only** its own topology and matrices;
4. emits **structured equations** (`LinearEquation` = terms over `VarRef` + rhs);
5. assembles `M x = r` *from those same equation objects* (`systemFromEquations`).
   The system the user reads is therefore the one that is solved;
6. solves with the numerical engine (rank check, then math.js LU with partial
   pivoting, residual and condition estimate);
7. recovers every branch current/voltage, computes power, node potentials and
   verification (`finalize`).

## Branch model (generalised branch, §17.11)

| Element | z | y | v_g | i_g | ideal |
|---|---|---|---|---|---|
| R | R | 1/R | 0 | 0 | — |
| E (pin a = +) | 0 | — | −sE | 0 | V |
| I (arrow a→b) | — | 0 | 0 | −sI | I |

`s = +1` when the branch runs pin a → pin b, otherwise −1.

## The six methods

### Incidence Matrix A (`solvers/incidence`) — needs a reference node
Textbook procedure of §17.3–17.4 (shared engine: `solvers/common/partitioned.ts`):
partition `A = [Aₚ  A_g]` (passive | current sources), `Yₙ = Aₚ Yₚ Aₚᵀ`,
`Vₙ = −Yₙ⁻¹ A_g I_g`, then `V = AᵀVₙ` and `Iₚ = Yₚ Vₚ`. Here `Yₚ` is the bₚ × bₚ
matrix of the passive branches only. Ideal V-sources form a third partition `A_v`
(extra unknown `I_v` and constraint `A_vᵀ Vₙ = V_v`; replaces the book's v-shift).
Matrices shown: `Aa`, `A`, `Ap`, `Ag` (`Av`), `Yp`, `Yn` (+ augmented `M`).

### Nodal (`solvers/nodal`) — needs a reference node
`Yₙ = A Yp Aᵀ`, `r = A(i_g − Yp v_g)`. Each ideal V-source adds its current as
an unknown, plus the constraint `A_Vᵀ vₙ = v_V` (MATHEMATICS.md §5).
Matrices shown: `A`, `Yp`, `Yₙ` (+ augmented `M` if there are V-sources).

### Fundamental Circuit Matrix Bf (`solvers/loop/fcircuitMethod`) — needs a tree
Textbook procedure of §17.6–17.7: partition `Bf = [B_fg  B_fp]` (voltage sources |
passive), `Z_L = B_fp Zₚ B_fpᵀ`, `Iₗ = −Z_L⁻¹ B_fg V_g`, then `I = BfᵀIₗ` and
`Vₚ = Zₚ Iₚ`. Ideal I-sources form a third partition `B_fi` (extra unknown `V_i`,
constraint `B_fiᵀ Iₗ = I_i`; replaces the book's i-shift).
Matrices: `Bf`, `Bfp`, `Bfg` (`Bfi`), `Zp`, `ZL` (+ augmented `M`).

### Loop (`solvers/loop`) — needs a tree
`Z_L = Bf Zp Bfᵀ`, `r = Bf(v_g − Zp i_g)`. Each ideal I-source adds its voltage
as an unknown, plus the constraint `B_Iᵀ iₗ = i_I`.
Matrices: `Bf`, `Zp`, `Z_L` (+ augmented `M`).

### Fundamental Cut-Set Matrix Qf (`solvers/nodePair/fcutsetMethod`) — needs a tree
Textbook procedure of §17.9–17.10: partition `Qf = [Q_fg  Q_fp]` (current sources |
passive), `Yₜ = Q_fp Yₚ Q_fpᵀ`, `Vₜ = −Yₜ⁻¹ Q_fg I_g`, then `V = QfᵀVₜ` and
`Iₚ = Yₚ Vₚ`. Ideal V-sources form a third partition `Q_fv` (as for A).
Matrices: `Qf`, `Qfp`, `Qfg` (`Qfv`), `Yp`, `Yt` (+ augmented `M`).

> **Why do A/Bf/Qf and Nodal/Loop/Node-pair give the same equation?** The book has
> one solution procedure per matrix: A → nodal, Bf → loop, Qf → node-pair. NETTOPO's
> A, Bf and Qf methods run the book's **partitioned** procedure (§17.4, §17.7,
> §17.10: passive branches and the relevant source branches are treated as
> separate partitions). NETTOPO preserves branch indices and extracts the
> partition matrices; it does not renumber the circuit branches. Nodal, Loop and
> Node-Pair run the **generalised-branch** form of §17.11. They are the same
> mathematics in two textbook notations, so the numbers agree; the step lists differ.

### Node-Pair (`solvers/nodePair`) — needs a tree
`Yₜ = Qf Yp Qfᵀ`, `r = Qf(i_g − Yp v_g)`. Ideal V-sources are augmented as in nodal.

## Results

`AnalysisResult` contains the method, network snapshot, reference node,
potential reference, tree info (with f-circuits / f-cut-sets when built),
labelled matrices, equation groups, unknowns, solution, primary unknowns,
node voltages, branch currents / voltages / power, verification, calculation steps,
warnings and solver info (size, rank, residual, κ₁ estimate).

## Failures (never NaN)

| Code | Cause | Message example |
|---|---|---|
| `network-invalid` | structural issue | "R1 (b1): Resistance must be greater than 0 Ω…" |
| `missing-reference` | nodal / incidence without a reference | "Select a reference node before running nodal analysis." |
| `invalid-reference` | reference deleted | "…no longer exists (the circuit changed)." |
| `missing-tree` / `invalid-tree` | tree-based methods | the tree validation messages |
| `ill-posed` | loop of V-sources / cut-set of I-sources | "Voltage sources V2, V1 form a loop containing only voltage sources…" |
| `singular` | rank-deficient system | "…singular (rank 4 < 5). Undetermined unknowns: …" |
| `unsupported` | internal error caught | explicit message, no crash |

## Method comparison

`compareMethods(net, methods, config)` is the only place where several
solvers run, and only from the Compare dialog. Node voltages are compared
relative to a common reference. The dialog reports the spread per quantity and
the maximum spread.
