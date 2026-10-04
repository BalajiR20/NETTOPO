# NETTOPO — Graph & Topology Engines

All code here is pure TypeScript with no React. The input is always the
`Network` (oriented graph) derived from the schematic. Conventions are in
[MATHEMATICS.md](MATHEMATICS.md).

## 1. From schematic to oriented graph — `domain/network/derive.ts`

```
pins = {component pins a/b} ∪ {node-marker pins} ∪ {ground pins}
union-find over pins:  every wire unites its two pins; all grounds are united
node  = one union-find set
branch = one component; orientation pin a → pin b (swapped if `reversed`)
```

Node identity is stable under editing:

| Set contains | Node id | Label |
|---|---|---|
| a ground | `gnd` | first named marker, else `GND` |
| a named node marker | that marker's id | its label |
| junction markers only | first junction id | `n1, n2, …` |
| component pins only | `net:<component>:<pin>` | `n1, n2, …` |

Node order: named nodes, then unnamed nets, then ground last. This follows the
textbook habit of numbering the reference node last.

Structural issues reported with actionable hints: empty circuit, self-loop
(both terminals on one node), floating node, invalid element value,
disconnected graph, unconnected terminal (warning), several named markers
wired together (warning).

`topologySignature()` and `valueSignature()` separate topology changes from
value changes for the invalidation policy.

## 2. Graph engine — `engine/graph`

| Function | Algorithm |
|---|---|
| `buildAdjacency` | incidence lists with traversal direction (`forward` = along orientation) |
| `connectedComponents` | iterative DFS |
| `isConnected`, `componentCount` | components over all / a subset of branches |
| `findPath` | BFS, fewest branches, returns oriented steps |
| `findCycle` / `hasCycle` | union-find; on the first closing edge, BFS path through the accepted forest |
| `bfsOrder` | BFS tree order with the branch used to reach each node (used for node potentials) |

## 3. Incidence — `engine/topology/incidence`

* `incidenceEntry(branch, node)`: +1 away, −1 towards, 0 otherwise.
* `allIncidenceMatrix` (n × b) and `reducedIncidenceMatrix(ref)` ((n−1) × b).
  Rows and columns are `MatrixAxisEntry` objects carrying the node or branch
  id, so every entry can be traced to node + branch + orientation.
* `explainIncidenceEntry` produces the "why is this entry ±1" text.
* `countSpanningTrees` = `det(A Aᵀ)` (Binet–Cauchy, §17.2).

## 4. Trees — `engine/topology/tree`

* `validateTree(net, twigs)` returns the counts shown in the UI (selected vs
  required, nodes covered, connected, cycle) plus actionable messages:
  *"Tree cannot contain a cycle: b4, b5, b6 form a loop"*, *"Select one more
  branch to include all nodes"*, *"A tree of 4 nodes has exactly 3 twigs. Remove 1 branch."*
* `suggestSpanningTree` is Kruskal with priority V-source → resistor →
  I-source, then branch number. This gives the textbook's "proper tree"
  (§17.3.1, §17.6.1) whenever one exists.
* `findSpanningTrees(limit)` uses include/exclude backtracking with cycle
  pruning. Tests use it to compare against det(A Aᵀ) and to run every solver on
  every tree.
* `checkWellPosedness` uses the proper tree. A voltage source that cannot be
  a twig closes a loop made only of V-sources. A current source that is forced
  into the tree defines a cut-set made only of I-sources. Both are reported
  together with the offending sources.

## 5. Fundamental circuits — `engine/topology/fundamentalCircuit`

For each link `l: a → b`:

1. traverse the link `a → b` (entry +1),
2. follow the unique **tree** path `b → a` (BFS over twigs),
3. each twig on the path gets +1 if stepped along its orientation, else −1.

The result is `FundamentalCircuit { linkId, entries, branchOrder, nodeOrder }`,
which is used for the Bf rows, the circuit highlighting (with ±1 badges) and
the KVL check. `fundamentalCircuitMatrix(order)` gives natural order
(b1…bb) or the partitioned `[B_ft | U]` order. The UI can switch between them
because columns are labelled.

## 6. Fundamental cut-sets — `engine/topology/cutset`

For each twig `t: a → b`:

1. remove `t` from the tree and take the connected component of the remaining
   twigs that contains `a`. This is `sideFrom`, and the rest is `sideTo`.
2. every branch with one end on each side belongs to the cut-set: +1 when it
   points `sideFrom → sideTo` (agreeing with the twig), −1 otherwise.

`fundamentalCutSetMatrix(order)` gives natural order or `[U | Q_fl]`. The node
sides drive the two-colour tinting of the cut-set highlight.

## 7. Verified identities

The test suite asserts, on textbook graphs and on every spanning tree:

* the printed `Aa` of Fig. 17.2-1 and its 35 spanning trees;
* the printed `Bf` of Example 17.7-1;
* `A Bfᵀ = 0`, `Qf Bfᵀ = 0`, `Q_fl = −B_ftᵀ`, `|det A_t| = 1`;
* `rank A = rank Qf = n − 1`, `rank Bf = b − n + 1`;
* reversing a branch flips its column in A, Bf and Qf. A link also flips its
  f-circuit row, and a twig also flips its f-cut-set row.
