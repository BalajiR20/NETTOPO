# NETTOPO — Roadmap

## Next (architecture already prepared)

| Feature | Where it plugs in |
|---|---|
| **Capacitor / inductor** | new `ElementKind` + descriptor; `BranchModel` with complex `z/y` (phasor) or companion models (transient) |
| **AC sinusoidal steady state** | complex-valued solvers reusing the same A / Bf / Qf (topology is unchanged); `SignalDefinition.sinusoid` already drives the oscilloscope |
| **Transient analysis** | time-stepping with companion models; `SignalDefinition.sampled` feeds the oscilloscope unchanged |
| **Dependent sources** (VCCS, CCCS, VCVS, CCVS) | off-diagonal `Yp`/`Zp` entries exactly as in §17.4.2 / §17.10.1; controlling-variable references in the element model |
| **Frequency response** | sweep of the AC solver; Bode panel next to the oscilloscope |
| **Thevenin / Norton** | port selection, then two solves (open-circuit voltage and short-circuit current) on the existing engine |
| **Two-port parameters** | z / y / h / ABCD from repeated solves |
| **State-space** | from the tree: capacitors as twigs, inductors as links (normal tree) |
| **PWA** | service worker caching of the already-offline bundle |

## Educational modes (modular, planned)

* **Practice mode** with a step-by-step quiz.
* "Find the incorrect matrix entry" (a deliberately corrupted A / Bf / Qf; the
  explanation engine already produces per-entry reasons).
* "Select a valid spanning tree" (uses `validateTree`).
* "Identify twigs and links", "Construct Bf", "Construct Qf" (answers
  checked against the topology engine).
* "Verify KCL / KVL" (the student enters sums and they are checked against the
  verification engine).

## Further ideas

* SPICE netlist import/export.
* Mesh analysis for planar graphs (§17.7.3), with a mesh-detecting planar embedding.
* All-loop / all-cut-set matrices (Ba, Qa) as optional explorer stages.
* Optimisation (component sizing) and AI explanation / natural-language circuit
  entry. These build on the structured `AnalysisResult` and equation model.
