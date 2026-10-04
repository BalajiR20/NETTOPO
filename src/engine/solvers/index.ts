import type { AnalysisConfig, AnalysisOutcome, AnalysisResult, MethodId } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import { suggestSpanningTree } from '@/engine/topology'
import { solveIncidence } from './incidence'
import { solveFundamentalCircuit } from './loop/fcircuitMethod'
import { solveLoop } from './loop'
import { solveNodal } from './nodal'
import { solveFundamentalCutSet } from './nodePair/fcutsetMethod'
import { solveNodePair } from './nodePair'

const SOLVERS: Record<MethodId, (net: Network, config: AnalysisConfig) => AnalysisOutcome> = {
  incidence: solveIncidence,
  nodal: solveNodal,
  fcircuit: solveFundamentalCircuit,
  loop: solveLoop,
  fcutset: solveFundamentalCutSet,
  nodePair: solveNodePair,
}

/** Runs exactly ONE method: only the mathematics that method needs is built. */
export function runAnalysis(method: MethodId, net: Network, config: AnalysisConfig): AnalysisOutcome {
  try {
    return SOLVERS[method](net, config)
  } catch (e) {
    return {
      ok: false,
      method,
      errors: [{ code: 'unsupported', message: `Internal error while running the analysis: ${(e as Error).message}`, hint: 'Please report this circuit; the analysis engine hit an unexpected state.' }],
      steps: [],
      matrices: [],
      computedAt: Date.now(),
    }
  }
}

export interface ComparisonRow {
  key: string
  label: string
  unit: 'A' | 'V'
  values: Partial<Record<MethodId, number>>
  /** max − min across methods. */
  spread: number
}

export interface Comparison {
  methods: MethodId[]
  outcomes: Partial<Record<MethodId, AnalysisOutcome>>
  rows: ComparisonRow[]
  maxSpread: number
  usedSuggestedTree: boolean
  usedDefaultReference: boolean
}

/**
 * Method comparison: the ONLY place where several solvers run, and only on
 * explicit user request.
 */
export function compareMethods(net: Network, methods: MethodId[], config: AnalysisConfig): Comparison {
  let usedSuggestedTree = false
  let usedDefaultReference = false
  const cfg: AnalysisConfig = { ...config }
  if (!cfg.treeBranchIds?.length) {
    const t = suggestSpanningTree(net)
    cfg.treeBranchIds = t?.twigIds ?? null
    usedSuggestedTree = true
  }
  if (!cfg.referenceNodeId) {
    cfg.referenceNodeId = net.groundNodeId ?? net.nodes[net.nodes.length - 1]?.id ?? null
    usedDefaultReference = true
  }
  const outcomes: Partial<Record<MethodId, AnalysisOutcome>> = {}
  for (const m of methods) outcomes[m] = runAnalysis(m, net, cfg)
  const ok = methods.filter((m) => outcomes[m]?.ok) as MethodId[]
  const rows: ComparisonRow[] = []
  const push = (key: string, label: string, unit: 'A' | 'V', get: (r: AnalysisResult) => number | undefined) => {
    const values: Partial<Record<MethodId, number>> = {}
    for (const m of ok) {
      const val = get(outcomes[m] as AnalysisResult)
      if (val !== undefined) values[m] = val
    }
    const vals = Object.values(values) as number[]
    rows.push({ key, label, unit, values, spread: vals.length ? Math.max(...vals) - Math.min(...vals) : 0 })
  }
  // Node voltages are compared relative to the same reference node.
  const refId = cfg.referenceNodeId!
  for (const n of net.nodes) {
    push(`vn:${n.id}`, `vₙ(${n.label}) w.r.t. ${net.nodes.find((x) => x.id === refId)?.label}`, 'V', (r) => {
      const a = r.nodeVoltages[n.id]
      const b = r.nodeVoltages[refId]
      return a === undefined || b === undefined ? undefined : a - b
    })
  }
  for (const b of net.branches) push(`i:${b.id}`, `i${b.index} (${b.elementLabel})`, 'A', (r) => r.branchCurrents[b.id])
  for (const b of net.branches) push(`v:${b.id}`, `v${b.index} (${b.elementLabel})`, 'V', (r) => r.branchVoltages[b.id])
  return { methods, outcomes, rows, maxSpread: rows.reduce((m, r) => Math.max(m, r.spread), 0), usedSuggestedTree, usedDefaultReference }
}

export { solveIncidence, solveNodal, solveFundamentalCircuit, solveLoop, solveFundamentalCutSet, solveNodePair }
