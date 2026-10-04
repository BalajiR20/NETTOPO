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
Unknowns `[vₙ; v; i]` (size n − 1 + 2b).
`A i = 0` (KCL), `v − Aᵀvₙ = 0` (node transformation), element relations.
Matrices shown: `Aa`, `A`, tableau `M | r`.

### Nodal (`solvers/nodal`) — needs a reference node
`Yₙ = A Yp Aᵀ`, `r = A(i_g − Yp v_g)`. Each ideal V-source adds its current as
an unknown, plus the constraint `A_Vᵀ vₙ = v_V` (MATHEMATICS.md §5).
Matrices shown: `A`, `Yp`, `Yₙ` (+ augmented `M` if there are V-sources).

### Fundamental Circuit Matrix Bf (`solvers/loop/fcircuitMethod`) — needs a tree
Unknowns `[iₗ; v; i]` (size b − n + 1 + 2b).
`Bf v = 0` (KVL), `i − Bfᵀ iₗ = 0`, element relations. Matrices: `Bf`, tableau.

### Loop (`solvers/loop`) — needs a tree
`Z_L = Bf Zp Bfᵀ`, `r = Bf(v_g − Zp i_g)`. Each ideal I-source adds its voltage
as an unknown, plus the constraint `B_Iᵀ iₗ = i_I`.
Matrices: `Bf`, `Zp`, `Z_L` (+ augmented `M`).

### Fundamental Cut-Set Matrix Qf (`solvers/nodePair/fcutsetMethod`) — needs a tree
Unknowns `[vₜ; v; i]`. `Qf i = 0` (KCL), `v − Qfᵀ vₜ = 0`, element relations.

### Node-Pair (`solvers/nodePair`) — needs a tree
`Yₜ = Qf Yp Qfᵀ`, `r = Qf(i_g − Yp v_g)`. Ideal V-sources are augmented as in nodal.

## Results

`AnalysisResult` contains the method, network snapshot, reference node,
potential reference, tree info (with f-circuits / f-cut-sets when built),
labelled matrices, equation groups, unknowns, solution, primary unknowns,
node voltages, branch currents / voltages / power, verification, 13 steps,
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
