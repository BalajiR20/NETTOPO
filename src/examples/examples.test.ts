import { describe, expect, it } from 'vitest'
import { METHOD_IDS } from '@/domain/analysis/types'
import { deriveNetwork } from '@/domain/network/derive'
import { countSpanningTrees, suggestSpanningTree, validateTree } from '@/engine/topology'
import { runAnalysis } from '@/engine/solvers'
import { EXAMPLES, exampleSchematic } from '@/examples'
import { branchIds, br, expectOk, nodeId } from '@/tests/helpers'

describe.each(EXAMPLES)('example: $title', (ex) => {
  const net = deriveNetwork(exampleSchematic(ex))

  it('derives a valid, connected network', () => {
    expect(net.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('preset tree (if any) is valid', () => {
    if (ex.treeLabels) expect(validateTree(net, branchIds(net, ex.treeLabels)).valid).toBe(true)
  })

  it.each(METHOD_IDS)('%s reproduces the expected results', (m) => {
    const ref = nodeId(net, ex.referenceLabel)
    const tree = ex.treeLabels ? branchIds(net, ex.treeLabels) : suggestSpanningTree(net)!.twigIds
    const r = expectOk(runAnalysis(m, net, { referenceNodeId: ref, treeBranchIds: tree }))
    for (const [label, v] of Object.entries(ex.expected.nodeVoltages ?? {})) expect(r.nodeVoltages[nodeId(net, label)] - r.nodeVoltages[ref]).toBeCloseTo(v, 9)
    for (const [label, v] of Object.entries(ex.expected.branchCurrents ?? {})) expect(r.branchCurrents[br(net, label).id]).toBeCloseTo(v, 9)
    for (const [label, v] of Object.entries(ex.expected.branchVoltages ?? {})) expect(r.branchVoltages[br(net, label).id]).toBeCloseTo(v, 9)
    expect(r.verification.overall).toBe('pass')
  })
})

describe('example topology facts', () => {
  it('Wheatstone bridge (K4) has 16 spanning trees', () => {
    const ex = EXAMPLES.find((e) => e.id === 'wheatstone')!
    expect(countSpanningTrees(deriveNetwork(exampleSchematic(ex)))).toBe(16)
  })
})
