import { describe, expect, it } from 'vitest'
import { METHOD_IDS, type MethodId } from '@/domain/analysis/types'
import { deriveNetwork } from '@/domain/network/derive'
import { schematicFromGraph, type GraphSpec } from '@/domain/schematic/fromGraph'
import type { Schematic } from '@/domain/schematic/types'
import { runAnalysis } from '@/engine/solvers'
import { allIncidenceMatrix, fundamentalCircuitMatrix, fundamentalCutSetMatrix, makeTree, suggestSpanningTree } from '@/engine/topology'
import { bridge, example17_4_1, example17_7_1 } from '@/tests/fixtures/textbook'
import { expectOk } from '@/tests/helpers'

/**
 * §55 Orientation invariance: reversing a branch's orientation does not change
 * the physical circuit. Reference signs of vₖ/iₖ flip; matrix columns flip;
 * node potentials, power and every other branch quantity are unchanged.
 */
const reverse = (s: Schematic, componentIds: string[]): Schematic => ({
  ...s,
  components: s.components.map((c) => (componentIds.includes(c.id) ? { ...c, reversed: !c.reversed } : c)),
})

function check(spec: GraphSpec, flips: number[][]) {
  const s0 = schematicFromGraph(spec)
  const n0 = deriveNetwork(s0)
  const ref = n0.groundNodeId!
  const tree = suggestSpanningTree(n0)!.twigIds
  for (const flip of flips) {
    const ids = flip.map((k) => s0.components[k].id)
    const n1 = deriveNetwork(reverse(s0, ids))
    // Same nodes, same branch ids, flipped endpoints.
    expect(n1.nodes.map((n) => n.id)).toEqual(n0.nodes.map((n) => n.id))
    for (const k of flip) {
      expect(n1.branches[k].fromNode).toBe(n0.branches[k].toNode)
      expect(n1.branches[k].polarity).toBe(-n0.branches[k].polarity)
    }
    // Aa: columns of flipped branches change sign; others unchanged.
    const t = makeTree(n0, tree)
    const a0 = allIncidenceMatrix(n0).data
    const a1 = allIncidenceMatrix(n1).data
    a0.forEach((row, i) => row.forEach((x, j) => expect(a1[i][j]).toBe(flip.includes(j) ? -x || 0 : x)))
    // Bf: a flipped LINK also reverses its f-circuit direction (row), since the f-circuit agrees with its link.
    const b0 = fundamentalCircuitMatrix(n0, t)
    const b1 = fundamentalCircuitMatrix(n1, makeTree(n1, tree))
    b0.data.forEach((row, i) => {
      const linkK = n0.branches.findIndex((b) => b.id === b0.rows[i].refId)
      const rowSign = flip.includes(linkK) ? -1 : 1
      row.forEach((x, j) => expect(b1.data[i][j]).toBe((flip.includes(j) ? -1 : 1) * rowSign * x || 0))
    })
    // Qf: a flipped TWIG flips its cut-set orientation (row) as well as its column.
    const q0 = fundamentalCutSetMatrix(n0, t)
    const q1 = fundamentalCutSetMatrix(n1, makeTree(n1, tree))
    q0.data.forEach((row, i) => {
      const twigK = n0.branches.findIndex((b) => b.id === q0.rows[i].refId)
      const rowSign = flip.includes(twigK) ? -1 : 1
      row.forEach((x, j) => expect(q1.data[i][j]).toBe((flip.includes(j) ? -1 : 1) * rowSign * x || 0))
    })

    for (const m of METHOD_IDS as readonly MethodId[]) {
      const cfg = { referenceNodeId: ref, treeBranchIds: tree }
      const r0 = expectOk(runAnalysis(m, n0, cfg))
      const r1 = expectOk(runAnalysis(m, n1, cfg))
      n0.branches.forEach((b, k) => {
        const s = flip.includes(k) ? -1 : 1
        expect(r1.branchCurrents[b.id]).toBeCloseTo(s * r0.branchCurrents[b.id], 9)
        expect(r1.branchVoltages[b.id]).toBeCloseTo(s * r0.branchVoltages[b.id], 9)
        expect(r1.branches[k].power).toBeCloseTo(r0.branches[k].power, 9)
      })
      for (const n of n0.nodes) expect(r1.nodeVoltages[n.id] - r1.nodeVoltages[ref]).toBeCloseTo(r0.nodeVoltages[n.id] - r0.nodeVoltages[ref], 9)
      expect(r1.verification.overall).toBe('pass')
    }
  }
}

describe('orientation invariance', () => {
  it('Example 17.4-1: flipping resistors and current sources', () => check(example17_4_1, [[0], [6], [2, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]]))
  it('Example 17.7-1: flipping voltage sources and resistors', () => check(example17_7_1, [[0], [3, 4], [5, 7], [0, 1, 2, 3]]))
  it('bridge with zero-current branch', () => check(bridge, [[4], [0, 6]]))
})
