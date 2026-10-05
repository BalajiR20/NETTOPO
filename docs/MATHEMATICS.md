# NETTOPO — Mathematical Reference

This document fixes every mathematical convention used by NETTOPO. The primary
reference is **K. S. Suresh Kumar, _Electric Circuits and Networks_, Chapter 17 —
Introduction to Network Topology**. Section numbers below (§17.x) refer to that
chapter. Where the textbook does not specify a detail that software needs, the
implementation decision is marked **[Implementation decision]** and justified.

---

## 1. Linear oriented graph (§17.1)

* An electrical network is represented by a **linear graph**: every two-terminal
  element becomes a **branch**, every junction becomes a **node**.
* Each branch is given an **orientation** (an arrow). The orientation is the
  **reference direction of the branch current** `iₖ`.
* The reference polarity of the branch voltage `vₖ` follows the **passive sign
  convention**: the `+` end is the node the branch starts at (the current enters
  the `+` terminal).

In NETTOPO a branch `bₖ` has `fromNode → toNode`; therefore

```
vₖ = v(fromNode) − v(toNode)          (passive sign convention)
iₖ flows fromNode → toNode through the element
pₖ = vₖ iₖ  = power ABSORBED by branch k   (negative ⇒ delivered)
```

Definitions used verbatim from §17.1.1:

| Term | Definition |
|---|---|
| Path | Subgraph with two terminal nodes of degree 1, all other nodes of degree 2 |
| Connected graph | At least one path between any two nodes |
| Loop | Connected subgraph with exactly two branches incident at each of its nodes |
| Tree | Connected subgraph containing **all** nodes and **no** loops |
| Twig | Branch of the tree |
| Link | Branch not in the tree (the links form the co-tree) |

A tree of an `n`-node connected graph has exactly `n − 1` twigs and
`b − n + 1` links.

[Implementation decision] **Wires are not branches.** A wire in the schematic is
an ideal connection; all pins joined by wires form one node. This is exactly the
textbook's process of replacing interconnections by node "bubbles" (§17.1).
Ground symbols are all joined into one node.

---

## 2. Incidence matrices (§17.2)

### All-incidence matrix `Aa` (n × b)

```
a_ij = +1  if branch j is incident at node i and oriented AWAY from it
a_ij = −1  if branch j is incident at node i and oriented TOWARDS it
a_ij =  0  if branch j is not incident at node i
```

Every column has exactly one `+1` and one `−1`, so the rows of `Aa` sum to zero.

### Reduced incidence matrix `A` ((n−1) × b)

`A` is `Aa` with the row of the **reference node** removed. The textbook calls
`A` simply "the incidence matrix". NETTOPO shows both, labelled `A_a` and `A`.

* `rank(A) = n − 1` for a connected graph.
* Partitioned by a tree, `A = [A_t  A_l]` and `det(A_t) = ±1`.
* Number of spanning trees `= det(A Aᵀ)` (Binet–Cauchy). NETTOPO uses this to
  report the tree count and tests it against the textbook's 35 trees of
  Fig. 17.2-1.

### KCL and the node transformation (§17.3)

```
A i = 0                (17.3-1)  (n−1 independent KCL equations)
v = Aᵀ vₙ              (17.3-3)  node transformation equation
```

`vₙ` = node voltages with respect to the reference node (the same node that was
dropped from `Aa`).

---

## 3. Fundamental circuit matrix `Bf` (§17.5, §17.6)

* Adding link `l` to the tree creates exactly one loop: the **f-circuit** of `l`.
* The f-circuit's direction of traversal is chosen so that it **agrees with the
  orientation of its link**.
* Entry rule:

```
b_ij = +1  branch j is in f-circuit i and its orientation agrees with the traversal
b_ij = −1  branch j is in f-circuit i and disagrees
b_ij =  0  branch j is not in f-circuit i
```

* Rows are ordered like the links; with columns ordered twigs-first,
  `Bf = [B_ft  U]` ((b−n+1) × b), `rank(Bf) = b − n + 1`.

Kirchhoff's laws in `Bf` form:

```
Bf v = 0               (17.6-2)  KVL, b − n + 1 independent loop equations
i = Bfᵀ i_l            (17.6-3)  every branch current from the link currents
```

Orthogonality (17.5-2): `A Bfᵀ = 0`, and `B_ft = −(A_t⁻¹ A_l)ᵀ`.

**Algorithm (NETTOPO):** for link `l: a → b`, traverse the link `a → b`, then
follow the unique tree path `b → a`. Each twig on that path gets `+1` if it is
traversed in the direction of its orientation, `−1` otherwise. The link itself
gets `+1`.

---

## 4. Fundamental cut-set matrix `Qf` (§17.8, §17.9)

* A **cut-set** is a minimal set of branches whose removal splits the connected
  graph into exactly two connected subgraphs.
* Removing a twig `t` from the tree splits the nodes into two groups. The twig
  together with every link joining the two groups is the **f-cut-set** of `t`.
* The f-cut-set's orientation **agrees with the orientation of its twig**.

```
q_ij = +1  branch j is in f-cut-set i and its orientation agrees with the cut-set
q_ij = −1  branch j is in f-cut-set i and disagrees
q_ij =  0  otherwise
```

With twigs first, `Qf = [U  Q_fl]` ((n−1) × b), `rank(Qf) = n − 1`, and

```
Q_fl = −B_ftᵀ = A_t⁻¹ A_l            (17.8-2)
Qf i = 0                              (17.10-1)  KCL
v = Qfᵀ v_t                           (17.10-2)  KVL, twig voltages as basis
Qf Bfᵀ = 0                            orthogonality
```

**Algorithm (NETTOPO):** remove twig `t: a → b` from the tree; the tree splits
into the side containing `a` (S₁) and the side containing `b` (S₂). The cut-set
is oriented S₁ → S₂ (agreeing with the twig). Any branch with `from ∈ S₁, to ∈ S₂`
gets `+1`; any branch with `from ∈ S₂, to ∈ S₁` gets `−1`.

---

## 5. Generalised branch model (§17.11)

Fig. 17.11-1: a passive impedance `zₖ` (admittance `yₖ`) in series with a voltage
source `v_gk`, the combination paralleled by a current source `i_gk`.

```
vₖ = v_pk − v_gk
iₖ = i_pk − i_gk
v_pk = zₖ i_pk ,   i_pk = yₖ v_pk
```

NETTOPO's initial elements map onto this model as follows (`s = ±1` is the
element polarity relative to the branch orientation, see §7):

| Element | Branch relation | `zₖ` | `yₖ` | `v_gk` | `i_gk` |
|---|---|---|---|---|---|
| Resistor `R` | `vₖ = R iₖ` | `R` | `1/R` | 0 | 0 |
| Voltage source `E` | `vₖ = s·E` | 0 | — (∞) | `−s·E` | 0 |
| Current source `I` | `iₖ = s·I` | — (∞) | 0 | 0 | `−s·I` |

The textbook's general equations (§17.11.1–17.11.3):

```
Node:       A Yp Aᵀ vₙ   = A [i_g − Yp v_g]
Loop:       Bf Zp Bfᵀ i_l = Bf [v_g − Zp i_g]
Node-pair:  Qf Yp Qfᵀ v_t = Qf [i_g − Yp v_g]
```

### Ideal (unaccompanied) sources — [Implementation decision]

The textbook requires either `zₖ` or `yₖ` to exist and be non-zero, and prepares
networks with unaccompanied sources by **v-shift** (§17.4.1) and **i-shift**
(§17.7.1) followed by source transformation. These are manual circuit edits.
NETTOPO solves the **unchanged circuit** using the standard *augmentation*, which
gives the same result:

* **Nodal / node-pair:** each ideal voltage-source branch `k` keeps its current
  `iₖ` as an extra unknown `xₖ`, and adds the constraint row `vₖ = s·E`:

  ```
  ⎡ A Yp Aᵀ   A_V ⎤ ⎡ vₙ ⎤   ⎡ A(i_g − Yp v_g) ⎤
  ⎣ A_Vᵀ       0  ⎦ ⎣ x  ⎦ = ⎣ v_V              ⎦
  ```
  (identical with `Qf` in place of `A` and `v_t` in place of `vₙ` for node-pair.)
* **Loop:** each ideal current-source branch keeps its voltage as an extra
  unknown and adds the constraint row `iₖ = s·I`:

  ```
  ⎡ Bf Zp Bfᵀ   B_I ⎤ ⎡ i_l ⎤   ⎡ Bf v_g ⎤
  ⎣ B_Iᵀ         0  ⎦ ⎣ x   ⎦ = ⎣ i_I    ⎦
  ```

When the network has no ideal source of the problematic kind, the augmented
block is empty and NETTOPO's equation is the textbook equation exactly.

---

## 6. The six NETTOPO methods

| Method | Needs | Unknowns | Equations |
|---|---|---|---|
| **Incidence Matrix A** | reference node | `vₙ` (+ ideal-V currents) | `Aₚ Yₚ Aₚᵀ vₙ = −A_g I_g` (§17.4, partitioned) |
| **Nodal Analysis** | reference node | `vₙ` (+ ideal-V currents) | `A Yp Aᵀ vₙ = A(i_g − Yp v_g)` |
| **Fundamental Circuit Matrix Bf** | spanning tree | `i_l` (+ ideal-I voltages) | `B_fp Zₚ B_fpᵀ i_l = −B_fg V_g` (§17.7, partitioned) |
| **Loop Analysis** | spanning tree | `i_l` (+ ideal-I voltages) | `Bf Zp Bfᵀ i_l = Bf(v_g − Zp i_g)` |
| **Fundamental Cut-Set Matrix Qf** | spanning tree | `v_t` (+ ideal-V currents) | `Q_fp Yₚ Q_fpᵀ v_t = −Q_fg I_g` (§17.10, partitioned) |
| **Node-Pair Analysis** | spanning tree | `v_t` (+ ideal-V currents) | `Qf Yp Qfᵀ v_t = Qf(i_g − Yp v_g)` |

**TEXTBOOK CONCEPT.** The three "matrix" methods (A, Bf, Qf) run the book's
*partitioned* procedures. Branches are numbered passive-first, sources-last, so
`T = [T_p  T_g]`; only the passive part meets the branch relation, giving
`Yₙ = Aₚ Yₚ Aₚᵀ` (17.4), `Z_L = B_fp Zₚ B_fpᵀ` (17.7) and `Yₜ = Q_fp Yₚ Q_fpᵀ` (17.10),
solved as `x = −[core]⁻¹ T_g g`. `Yₚ`/`Zₚ` here are bₚ × bₚ (passive branches only).

**IMPLEMENTATION DETAIL.** The book removes the *other* kind of ideal source by
v-shift / i-shift. NETTOPO appends a third partition `T_a` with the augmentation of
§5 instead, so the circuit is not edited. The three "analysis" methods (Nodal,
Loop, Node-Pair) use the equivalent generalised-branch form of §17.11 with
b × b matrices. Both families give the same numbers.

**Lazy rule:** only the matrices a method needs are ever built (§2 of the
product specification). Nodal never builds a tree; loop never builds `A`.

---

## 7. Element polarity

Every component has pins `a` and `b`.

* Voltage source: pin `a` is the `+` terminal; `V(a) − V(b) = E`.
* Current source: the arrow points from pin `a` to pin `b` *inside* the source,
  i.e. the source drives `I` out of pin `b` into the external circuit.
* By default the branch is oriented `a → b` (polarity `s = +1`). **Reverse
  orientation** swaps `from/to` and sets `s = −1`. The physical circuit does not
  change; only the reference signs of `vₖ` and `iₖ` change. This is the
  invariant tested in `orientation.test.ts`.

---

## 8. Node voltages for tree-based methods

Tree-based methods do not require a reference node. To display node voltages
(and to feed the oscilloscope) NETTOPO computes node potentials by walking the
tree from a **potential reference**. That reference is the ground node if one
exists, otherwise the first node. Each step uses `v(from) − v(to) = vₖ`. These
are labelled **derived node potentials**.

---

## 9. Tellegen's theorem (§17.12)

For any branch voltages that satisfy KVL and any branch currents that satisfy
KCL (passive sign convention):

```
Σₖ vₖ iₖ = vᵀ i = vₙᵀ A i = 0       (17.12-1)
```

NETTOPO evaluates the sum from the **computed** `v` and `i` vectors. It reports
the raw residual and the residual relative to `Σ|vₖ iₖ|`.

---

## 10. Well-posedness (§17.3.1, §17.6.1)

A network of resistors, independent V-sources and independent I-sources has a
unique solution only if a tree exists that contains **all voltage sources and
no current sources** (a necessary condition). Equivalently, there is no loop
made only of voltage sources and no cut-set made only of current sources.
NETTOPO checks this before solving by building a priority spanning tree
(V-sources first, resistors next, I-sources last, Kruskal). The check reports
which sources violate it.

---

## 11. Verification

| Check | Quantity | Source |
|---|---|---|
| KCL | `max |Aa i|` over **all** n nodes | §17.2, §17.3 |
| KVL | `max |Bf v|` for a spanning tree (the analysis tree, or a suggested one) | §17.6 |
| Element relations | `max` residual of `v − Ri`, `v − sE`, `i − sI` | §17.11 |
| Tellegen | `|Σ vₖ iₖ|` | §17.12 |
| Orthogonality | `max |A Bfᵀ|`, `max |Qf Bfᵀ|` | (17.5-2), §17.8.5 |
| Tree validity | `n − 1` twigs, connected, acyclic | §17.1.1 |
| Numerical residual | `‖M x − r‖∞` of the solved system | — |

Tolerance [Implementation decision]: with `scale = max(1, max|quantity|)`, a
check **passes** when `residual ≤ 1e-9·scale`. It gives a **warning** up to
`1e-6·scale` and **fails** above that.

---

## 12. Textbook examples used as test fixtures

| Fixture | Textbook | Verified result |
|---|---|---|
| `fig17_2_1` | Fig. 17.2-1 graph | `Aa`, reduced `A` (ref node 6), 35 spanning trees |
| `example17_4_1` | Example 17.4-1 | `Yn`, `Vn = [2, 1, 3] V`, source powers 18 W, 17 W, 42 W |
| `example17_7_1` | Example 17.7-1 | `Bf`, `Z_L`, `I_l = [1, 2, 3] A`, `I_g = [−1, −1, −1, 3] A` |
