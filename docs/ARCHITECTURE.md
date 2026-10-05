# NETTOPO — Software Architecture

## 1. Principle

> The graph is the source of truth. Mathematics flows one way:
> **circuit graph → topology → method → matrix → equations → solution →
> verification → visualization → report.**

Nothing is ever reconstructed from a matrix, and React Flow's internal
node/edge objects are a *view* of the schematic, never the model.

## 2. Layers

```
┌──────────────────────────────────────────────────────────────┐
│ UI layer            src/components, src/app   (React, shadcn) │
├──────────────────────────────────────────────────────────────┤
│ Application state   src/store                 (Zustand)       │
│   circuitStore · uiStore · analysisStore · simulationStore ·  │
│   reportStore · projectStore                                  │
├──────────────────────────────────────────────────────────────┤
│ Domain model        src/domain                (pure TS + Zod) │
│   schematic (editable document) → network (oriented graph)    │
│   elements · analysis types · topology types                  │
├──────────────────────────────────────────────────────────────┤
│ Graph engine        src/engine/graph          connectivity,   │
│                     adjacency, paths, cycles, components      │
├──────────────────────────────────────────────────────────────┤
│ Topology engine     src/engine/topology       A, tree, Bf, Qf │
├──────────────────────────────────────────────────────────────┤
│ Analysis engine     src/engine/solvers        incidence,      │
│                     nodal, loop, nodePair, common/partitioned │
├──────────────────────────────────────────────────────────────┤
│ Numerical engine    src/engine/numerical      math.js wrapper,│
│                     rank, conditioning, residuals, formatting │
├──────────────────────────────────────────────────────────────┤
│ Verification engine src/engine/verification   KCL, KVL,       │
│                     Tellegen, orthogonality, tree, residual   │
├──────────────────────────────────────────────────────────────┤
│ Simulation          src/engine/simulation     signal model    │
│                     (DC now; AC/transient-ready)              │
├──────────────────────────────────────────────────────────────┤
│ Reporting           src/engine/reporting      jsPDF report,   │
│                     SVG circuit renderer                      │
└──────────────────────────────────────────────────────────────┘
```

**Dependency rule:** a layer may import only from layers below it.
`src/engine/**` and `src/domain/**` never import React, Zustand or the DOM.
(The one exception is the reporting rasteriser, which needs a canvas. It is
isolated in `engine/reporting/rasterize.ts`.)

## 3. Two models: schematic and network

| | Schematic (`domain/schematic`) | Network (`domain/network`) |
|---|---|---|
| Purpose | What the user edits | What the mathematics uses |
| Contents | components, node markers, junctions, grounds, wires, positions, rotation | nodes, oriented branches, elements |
| Identity | component / marker ids | node ids, branch ids, branch index `k` |
| Persistence | saved in `.nettopo` files | derived, never saved |

`deriveNetwork(schematic)` is a pure function:

1. Union-find over every pin (component pins, node markers, junctions, grounds),
   uniting pins joined by wires; all grounds are united into one node.
2. Each resulting set becomes a **network node**. It takes its label from a
   node marker if one is present, `GND` for the ground net, otherwise `n?`.
3. Each component becomes a **branch** `bₖ` (k = 1…b in creation order). Its
   orientation is `pin a → pin b`, swapped if the component is `reversed`.
4. Structural issues (self-loops, floating markers, invalid values) are
   collected as `NetworkIssue`s with actionable messages.

Positions are used **only** for drawing (graph-view node placement uses the
centroid of a node's pins). They never affect identity or mathematics.

## 4. Lazy analysis and invalidation

`deriveNetwork` runs on every schematic change. It is cheap: only the general
network information (nodes, branches, connectivity, values, orientations).

No method-specific mathematics is computed until the user picks a method:

```
select method ─▶ (reference node | spanning tree) ─▶ run solver for THAT method
```

`analysisStore` keeps two signatures of the network:

* `topologySignature`: the nodes, the branch endpoints, orientation and element kind.
* `valueSignature`: the element values.

| Change | Effect |
|---|---|
| position / label only | nothing recomputed |
| value change | the same method re-runs on the cached configuration |
| topology change | result, tree and reference node invalidated; the user is asked again |
| tree change | only the tree-dependent method re-runs |
| method change | only that method runs |

Method comparison (`engine/solvers/compare.ts`) is the **only** place that
runs several solvers, and only when the user asks for it.

## 5. Analysis result contract

Every solver returns `AnalysisOutcome = AnalysisResult | AnalysisFailure`
(`domain/analysis/types.ts`). An `AnalysisResult` contains the method, a
network snapshot, the reference node / tree, labelled matrices with traceable
rows and columns, structured equations whose variables carry references,
unknowns, the solution, node voltages, branch currents, voltages and power,
verification, explanatory steps and warnings.

`LabeledMatrix` rows and columns carry `{kind, refId}`, so the UI can map a
row to a node, f-circuit or f-cut-set and a column to a branch. This is
what makes matrix ↔ circuit highlighting possible without reverse engineering.

Equation variables are emitted as KaTeX `\htmlData{ref=branch:b2}{i_{2}}`
so a click on `i₂` resolves to branch `b2` directly.

## 6. State management

| Store | Holds |
|---|---|
| `circuitStore` | schematic, undo/redo history, clipboard |
| `uiStore` | tool, selection, highlight, interaction mode (edit / reference / tree), display toggles, panels, theme |
| `analysisStore` | method, reference node, tree selection, result/failure, signatures |
| `simulationStore` | oscilloscope channels, run state, time/amplitude scale |
| `reportStore` | PDF export status |
| `projectStore` | project metadata, autosave status |

Components read state through narrow selectors to limit re-renders. The
derived network is memoised on schematic identity (`useNetwork`).

## 7. Canvas

React Flow (`@xyflow/react`) renders:

* `component` nodes: resistor, voltage source, current source (SVG symbols)
  with two handles,
* `marker` nodes: named nodes and junctions,
* `ground` nodes,
* `wire` edges (orthogonal routing).

The canvas is fully **controlled**: React Flow node/edge arrays are derived
from the schematic on each render, and every change (drag, connect, delete)
goes through `circuitStore` actions. A drag records a single history entry when
it stops.

The **oriented-graph view** (`components/topology/GraphView.tsx`) is a
separate SVG renderer of the *network* (not the schematic). It is used in
the canvas "Graph" mode and in the Topology Explorer.

## 8. Persistence

* `persistence/db.ts`: Dexie database `nettopo` with tables `projects`,
  `settings`, `autosave`.
* `domain/project/schema.ts`: versioned Zod schema (`schemaVersion: 1`) for
  `.nettopo` files, plus a `migrateProject()` hook for future versions.
* Autosave writes the working project 800 ms after the last change and
  shows *Unsaved changes → Saving… → Saved*.

## 9. Reporting

`engine/reporting/pdfReport.ts` builds the report from an `AnalysisResult`
and the schematic with jsPDF, entirely on the client. The circuit diagram
comes from `renderSchematicSvg()`, a pure SVG string renderer
independent of React Flow, and is rasterised to PNG. Matrices are drawn as
bracketed tables. The oscilloscope image is re-rendered off-screen by the same
pure drawing routine as the live scope (`engine/simulation/scopeRender.ts`).
DejaVu fonts are bundled and embedded so the report can show Ω, →, Σ and
subscripts offline.

## 10. Extensibility

* **Elements:** `domain/elements` defines a discriminated union with a
  per-kind descriptor (`ELEMENT_DESCRIPTORS`) giving units, the generalised
  branch mapping, the symbol and validation. Capacitors, inductors and
  dependent sources add a descriptor plus a branch-model mapping.
* **Analysis domain:** solvers work on `BranchModel` (z, y, v_g, i_g, ideal
  flags). AC requires complex `BranchModel` entries. The topology engine is
  unaffected because it is purely structural.
* **Signals:** `engine/simulation` exposes `SignalDefinition`
  (`dc | sampled | sinusoid`). The oscilloscope only calls `evaluate(t)`.
