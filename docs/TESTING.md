# NETTOPO — Testing

```bash
npm test            # Vitest: unit + integration (jsdom)
npm run test:e2e    # Playwright: end-to-end in Chromium (starts a dev server on :5174)
npm run check       # typecheck + lint + tests
```

## Unit tests (engine and domain)

| Suite | File | Proves |
|---|---|---|
| Network derivation | `domain/network/derive.test.ts` | wires → nodes, one branch per component, all grounds = one node, position-independence, value vs topology signatures, structural issues, schema rejects dangling wires / duplicate ids |
| Topology | `engine/topology/topology.test.ts` | printed `Aa` of Fig. 17.2-1, reduced A, traceability of every entry, **35 trees** by det(A Aᵀ) and by enumeration, det(A_t) = ±1, tree validation (valid, too few, too many, cycle, disconnected), proper-tree suggestion, **printed Bf of Example 17.7-1**, `[B_ft|U]`, `[U|Q_fl]`, `A Bfᵀ = 0`, `Qf Bfᵀ = 0`, `Q_fl = −B_ftᵀ`, dimensions and ranks, different trees → different matrices |
| Solvers | `engine/solvers/solvers.test.ts` | **Example 17.4-1**: `Yₙ`, `Vₙ = [2, 1, 3] V`, source powers 18/17/42 W. **Example 17.7-1**: `Z_L`, `Iₗ = [1, 2, 3] A`, `I_g = [−1,−1,−1,3] A`, powers 5/6/2/33 W. All six methods agree. Positive / negative / zero currents and voltages. All reference nodes. **Every spanning tree** for loop, node-pair, Bf, Qf. Lazy rule (no tree for nodal, no A for loop). Error states (missing reference/tree, invalid tree, V-loop, I-cut-set). Comparison |
| Partitioned solvers | `engine/solvers/partitioned.test.ts` | A, Bf and Qf follow the Chapter 17 partitioned equations; textbook matrix products and example results; no unnecessary topology matrices; mixed ideal-source augmentation agrees with nodal analysis and passes verification |
| Orientation | `engine/solvers/orientation.test.ts` | reversing any set of branches flips exactly the right matrix columns/rows and the reference signs of vₖ/iₖ, while power, node potentials and verification are unchanged, for every method |
| Verification | `engine/verification/verification.test.ts` | KCL/KVL/element/Tellegen pass for real solutions; corrupted currents/voltages are detected; Tellegen equals the actual Σ vₖiₖ; tree / orthogonality / rank checks; tolerance classification |
| Numerical | `engine/numerical/numerical.test.ts` | LU solve and residual, singular detection with undetermined unknowns, non-finite rejection, ill-conditioning warning, empty system, rank, formatting without NaN/undefined |
| Simulation | `engine/simulation/simulation.test.ts` | DC signals built from the actual result, available channels, sampled/sinusoid definitions |
| Reporting | `engine/reporting/reporting.test.ts` | the PDF contains every required section in order (with embedded fonts and with the ASCII fallback); the SVG schematic contains the real results |
| Examples | `examples/examples.test.ts` | each built-in example derives a valid network, has a valid preset tree and reproduces its **expected results with all six methods**; K₄ has 16 trees |
| Persistence | `persistence/persistence.test.ts` | `.nettopo` round-trip, invalid JSON / schema / future-version rejection, IndexedDB save/list/load/autosave (fake-indexeddb) |

## Integration tests

| File | Proves |
|---|---|
| `tests/integration/workflow.test.ts` | store actions build a circuit → derived network → method → solver → result; value change re-solves; topology change invalidates result and tree; position change recomputes nothing; undo/redo; copy/paste; missing reference |
| `tests/integration/components.test.tsx` | React Testing Library: method cards → reference → run → steps; live tree validation + suggest + confirm; matrix column/row click → highlight token; matrix entry explanation; equation variable click → highlight; verification and results panels render real values |

## End-to-end tests (`e2e/nettopo.spec.ts`)

1. **Create a circuit** by dragging components and wiring terminals, check the
   network status, select nodal analysis, pick the reference node, run, and see
   0.5 A and the Tellegen check.
2. **Signature flow:** Bf example → method dialog → tree-selection mode →
   suggest tree → VALID → confirm → click a Bf row → loop highlighted on the
   circuit → click `v₂` in an equation → branch highlighted → oscilloscope →
   verification without FAIL → **PDF download**.
3. **Error states:** an unconnected resistor is reported; nodal cannot run
   without a reference node.
4. **Save / new / open** through IndexedDB.

## Mathematical test discipline

Every topology algorithm is tested on at least two textbook graphs. Physical
invariance is tested in three directions: across methods, across trees, and
across orientations. The verification engine is itself tested by feeding it
deliberately wrong solutions.
