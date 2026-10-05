# NETTOPO — User Guide

## 1. Screen layout

| Area | Contents |
|---|---|
| **Top bar** | New · Open · Save · File (Import/Export JSON, Examples) · Undo · Redo · **Analyze** · Compare methods · **Export PDF** · Shortcuts · Settings · save status |
| **Left** | Component toolbox and the **Network** status (nodes, branches, connected, parts, reference node, issues) |
| **Centre** | Circuit canvas (Schematic) or the oriented graph (Graph), display toggles, mode banner |
| **Right** | **Properties** of the selection · **Analysis** workflow with step-by-step results |
| **Bottom** | Topology Explorer · Equations · Matrix · Results · Verification · Oscilloscope |

Panels can be resized. On screens narrower than 1024 px the side panels become
drawers, opened with the panel buttons at the edges of the top bar.

## 2. Building a circuit

1. Drag **Resistor**, **Voltage Source**, **Current Source**, **Node**, **Junction** or
   **Ground** onto the canvas, or click an item to drop it at the centre.
2. **Wire** terminals by dragging from one terminal dot to another. Click one terminal
   and then another to do the same. Press **W** (Wire tool) to show every terminal.
   Dropping a wire on empty canvas creates a junction there, which you can use to route wires.
3. Select a component to edit its **label** and **value** in Properties. Values
   accept SI suffixes: `4.7k`, `2.2m`, `500u`.
4. **R** rotates, **O** reverses the branch orientation, **Del** deletes.
   Ctrl+Z / Ctrl+Shift+Z undo and redo, Ctrl+C / Ctrl+V copy and paste.

Conventions: a voltage source's `+` is pin a (left, before rotating). A current
source's arrow points from pin a to pin b. The small blue arrow beside each
component is the **branch orientation**, which is the reference direction of iₖ.
vₖ is + at the tail of the arrow. Reversing the orientation never changes the
physical circuit.

Wires are not branches: everything joined by wires is a single node. All ground
symbols form one node.

## 3. Choosing a method

Press **Analyze** (or open the Analysis tab) and pick a card:

| Method | You must provide |
|---|---|
| Incidence Matrix A | reference node |
| Nodal Analysis | reference node |
| Fundamental Circuit Matrix Bf | spanning tree |
| Loop Analysis | spanning tree |
| Fundamental Cut-Set Matrix Qf | spanning tree |
| Node-Pair Analysis | spanning tree |

Nothing method-specific is computed before you choose.

### Reference node
Click a node in the list, or press **Pick on circuit** and click a node dot,
ground or wire. The reference node is drawn in purple with a dashed ring.

### Spanning tree
Tree-selection mode opens. Click branches on the circuit (or in the graph) to
toggle them as **twigs** (solid green); the rest are **links** (dashed amber).
The panel shows *Selected x / n−1*, *Nodes covered*, *Connected*, *Cycle* and
*Tree VALID/INVALID*, plus what to fix. **Suggest valid tree** picks one for
you, preferring voltage sources as twigs and current sources as links. Then
**Confirm tree & analyze**.

## 4. Reading the results

* **Analysis tab:** expandable calculation steps. Each has a **WHY?** that refers to Chapter 17.
* **Matrix tab:** click a column header to highlight its branch, a row header to
  highlight its node / f-circuit / f-cut-set, and an entry to see why it has that
  value. The *Twigs | links* switch shows the textbook partitioned form.
* **Equations tab:** click any variable (i₃, v₂, vₙ, iₗ, vₜ) to highlight it on
  the circuit, the graph and in the matrices.
* **Results tab:** primary unknowns, node voltages, and branch iₖ / vₖ / pₖ with
  *absorbed* or *delivered*. A negative iₖ means the actual current opposes the
  arrow; the canvas marks the actual direction.
* **Verification tab:** KCL, KVL, element relations, Tellegen (Σ vₖiₖ from the
  computed solution), orthogonality, tree validity, ranks and numerical residual,
  each with PASS / WARNING / FAIL.
* **Topology Explorer:** follow Circuit → Graph → Tree → f-circuits/cut-sets →
  Matrices → Equations → Solution → Verification → Visualization. Stages the
  method does not need are struck through.
* Toggle **Currents / Voltages / Power / Flow** above the canvas. *Flow* is a
  mathematical visualization of the computed currents, not an electron simulation.

Changing a value re-solves immediately with the same method. Changing the
topology (adding, deleting, rewiring or reversing) discards the results and the
tree confirmation, because they are no longer valid.

## 5. Oscilloscope

Open the **Oscilloscope** tab. Each channel can show a branch current, branch
voltage, node voltage or branch power from the current result. Use
Run/Pause/Reset, Time/div, the channel scale (auto or fixed per division) and
the offset. For DC every signal is a horizontal line at its computed value.
**Probe on scope** in Properties sends the selected branch's i and v to CH1/CH2.

## 6. Comparing methods

**Compare methods** runs the methods you tick (only then) and lists every node
voltage, branch current and branch voltage side by side with its spread.

## 7. Saving, files and reports

* Work is **autosaved** in the browser. The indicator shows *Unsaved changes →
  Saving… → Saved*. **Save** (Ctrl+S) stores the project in the library and
  **Open** lists stored projects.
* **File → Export JSON** downloads a `.nettopo` file. **Import JSON** validates it,
  and invalid files are rejected with the reasons.
* **Export PDF** creates an engineering report from the current result, entirely on your computer.

## 8. Examples

File → Examples: resistor divider, two-loop circuit, three-node network
(textbook Example 17.4-1), current-source network, multiple spanning-tree
network (K₄ bridge, 16 trees), Bf demonstration (textbook Example 17.7-1) and Qf
demonstration. Each example pre-selects a method and configuration but does
**not** run it: you confirm and run it yourself.

## 9. Keyboard shortcuts

Press **?** in the app for the full list: Del, Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, Ctrl+S,
Ctrl+C, Ctrl+V, Ctrl+A, R, O, W, +, −, F (fit), G (schematic/graph), Esc (leave
selection mode / clear).
