import { create } from 'zustand'
import { METHODS } from '@/domain/analysis/methods'
import type { AnalysisOutcome, MethodId } from '@/domain/analysis/types'
import { topologySignature, valueSignature } from '@/domain/network/derive'
import type { Network } from '@/domain/network/types'
import { runAnalysis } from '@/engine/solvers'
import { suggestSpanningTree } from '@/engine/topology'

export type AnalysisPhase = 'idle' | 'need-reference' | 'need-tree' | 'ready' | 'solved' | 'failed'

export interface AnalysisState {
  method: MethodId | null
  referenceNodeId: string | null
  treeBranchIds: string[]
  /** True once the user confirmed the tree selection. */
  treeConfirmed: boolean
  outcome: AnalysisOutcome | null
  /** Signatures of the network the outcome was computed for. */
  outcomeTopology: string | null
  outcomeValues: string | null
  /** Message shown when results were invalidated by a topology change. */
  invalidationNotice: string | null

  selectMethod(m: MethodId | null, net: Network): void
  setReference(id: string | null): void
  toggleTwig(id: string): void
  setTree(ids: string[]): void
  suggestTree(net: Network): void
  confirmTree(): void
  editTree(): void
  run(net: Network): AnalysisOutcome | null
  /** Called whenever the derived network changes. Implements the invalidation policy. */
  onNetworkChanged(net: Network): void
  reset(): void
  restore(cfg: { method: MethodId | null; referenceNodeId: string | null; treeBranchIds: string[] }): void
}

export function analysisPhase(st: Pick<AnalysisState, 'method' | 'referenceNodeId' | 'treeConfirmed' | 'outcome'>): AnalysisPhase {
  if (!st.method) return 'idle'
  const info = METHODS[st.method]
  if (info.requiresReference && !st.referenceNodeId) return 'need-reference'
  if (info.requiresTree && !st.treeConfirmed) return 'need-tree'
  if (st.outcome && st.outcome.method === st.method) return st.outcome.ok ? 'solved' : 'failed'
  return 'ready'
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  method: null,
  referenceNodeId: null,
  treeBranchIds: [],
  treeConfirmed: false,
  outcome: null,
  outcomeTopology: null,
  outcomeValues: null,
  invalidationNotice: null,

  selectMethod: (method, net) => {
    // Changing method discards the previous method's mathematics: only the new method will run.
    // The reference node / tree selection is kept if it still exists; the user still confirms it.
    const st = get()
    const ref = st.referenceNodeId && net.nodes.some((n) => n.id === st.referenceNodeId) ? st.referenceNodeId : null
    set({ method, outcome: null, outcomeTopology: null, outcomeValues: null, invalidationNotice: null, referenceNodeId: ref })
  },
  setReference: (referenceNodeId) => set({ referenceNodeId, outcome: null }),
  toggleTwig: (id) =>
    set((st) => ({
      treeBranchIds: st.treeBranchIds.includes(id) ? st.treeBranchIds.filter((x) => x !== id) : [...st.treeBranchIds, id],
      treeConfirmed: false,
      outcome: null,
    })),
  setTree: (ids) => set({ treeBranchIds: ids, treeConfirmed: false, outcome: null }),
  suggestTree: (net) => {
    const t = suggestSpanningTree(net)
    if (t) set({ treeBranchIds: t.twigIds, treeConfirmed: false, outcome: null })
  },
  confirmTree: () => set({ treeConfirmed: true }),
  editTree: () => set({ treeConfirmed: false, outcome: null }),
  run: (net) => {
    const st = get()
    if (!st.method) return null
    const outcome = runAnalysis(st.method, net, {
      referenceNodeId: st.referenceNodeId,
      treeBranchIds: st.treeConfirmed ? st.treeBranchIds : null,
    })
    set({ outcome, outcomeTopology: topologySignature(net), outcomeValues: valueSignature(net), invalidationNotice: null })
    return outcome
  },
  onNetworkChanged: (net) => {
    const st = get()
    const topo = topologySignature(net)
    const vals = valueSignature(net)
    // Reference / twig ids that no longer exist are dropped.
    const nodeIds = new Set(net.nodes.map((n) => n.id))
    const branchIds = new Set(net.branches.map((b) => b.id))
    const refGone = st.referenceNodeId !== null && !nodeIds.has(st.referenceNodeId)
    const tree = st.treeBranchIds.filter((id) => branchIds.has(id))
    if (st.outcomeTopology === null) {
      if (refGone || tree.length !== st.treeBranchIds.length) set({ referenceNodeId: refGone ? null : st.referenceNodeId, treeBranchIds: tree, treeConfirmed: false })
      return
    }
    if (topo !== st.outcomeTopology) {
      // Topology change: invalidate all topology-dependent results and the tree.
      set({
        outcome: null,
        outcomeTopology: null,
        outcomeValues: null,
        referenceNodeId: refGone ? null : st.referenceNodeId,
        treeBranchIds: tree,
        treeConfirmed: false,
        invalidationNotice: 'The circuit topology changed, so the previous results, matrices and tree confirmation were discarded. Re-check the configuration and run again.',
      })
      return
    }
    if (vals !== st.outcomeValues && st.method) {
      // Value change only: re-solve with the same method and configuration.
      get().run(net)
    }
  },
  reset: () => set({ method: null, referenceNodeId: null, treeBranchIds: [], treeConfirmed: false, outcome: null, outcomeTopology: null, outcomeValues: null, invalidationNotice: null }),
  restore: (cfg) =>
    set({
      method: cfg.method,
      referenceNodeId: cfg.referenceNodeId,
      treeBranchIds: cfg.treeBranchIds,
      treeConfirmed: false,
      outcome: null,
      outcomeTopology: null,
      outcomeValues: null,
      invalidationNotice: null,
    }),
}))
