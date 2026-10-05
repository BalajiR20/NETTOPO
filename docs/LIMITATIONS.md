# NETTOPO — Known Limitations

## Scope of the analysis

* **DC, linear, resistive, independent sources only.** There are no capacitors,
  inductors, dependent sources, AC or transient analysis yet. The architecture
  is prepared for them (see ROADMAP), but they are not implemented and are not
  shown as available.
* **Ideal sources are augmented, not v-/i-shifted.** The textbook prepares
  unaccompanied sources by v-shift / i-shift and source transformation
  (§17.4.1, §17.7.1). NETTOPO solves the unmodified circuit with extra unknowns
  (MATHEMATICS.md §5). Results are identical, but the step text describes
  augmentation rather than the manual shifting procedure.
* **Methods A, Bf and Qf and the textbook.** The book gives one solution
  procedure per matrix (A → nodal, Bf → loop, Qf → node-pair). NETTOPO runs these
  as the partitioned procedures of §17.4, §17.7 and §17.10, and the Nodal / Loop /
  Node-Pair methods as the generalised form of §17.11. Both give the same
  numbers (MATHEMATICS.md §6).
* **Zero-ohm resistors are rejected** (use a wire). An open circuit is a missing branch.
* **Hinged graphs** (§17.8.1) are handled correctly by the f-cut-set algorithm,
  which uses tree components. NETTOPO does not separately enumerate
  non-fundamental cut-sets (the all-cut-set matrix Qa) or all loops (Ba). These
  are not needed by any method.
* Graphs must be **connected**. Separate parts are reported as an error rather
  than analysed independently.

## Numerical

* Systems are solved densely (math.js LU). This is instantaneous for
  educational networks (tens of branches) but not intended for networks with
  thousands of branches.
* Tree enumeration (`findSpanningTrees`) is exponential and capped at 1000.
  The tree count uses det(A Aᵀ) and is shown for graphs up to 14 branches.
* Tolerances are relative (1e-9 pass, 1e-6 warning). Extremely ill-conditioned
  value ratios (e.g. 1 mΩ next to 1 TΩ) produce a conditioning warning.

## User interface

* Wires are drawn as orthogonal L-shapes between terminals with no automatic
  routing around components. Use junctions to route wires by hand.
* The oriented-graph view places nodes at the centroid of their schematic
  terminals, so very dense schematics can give overlapping graph edges.
  Parallel edges and edges passing through another node are curved.
* Touch editing works through React Flow, but the editor is tuned for mouse and keyboard.
* The PDF typesets matrices up to about 23 columns and one page high; larger
  matrices are replaced by a note (the app shows them in full).

## Persistence

* Projects are stored in this browser's IndexedDB. Clearing site data deletes
  them, so export `.nettopo` files for backups. There is no cloud sync.
