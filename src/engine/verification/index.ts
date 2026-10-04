import type { CheckStatus, VerificationCheck, VerificationReport } from '@/domain/analysis/types'
import type { Network } from '@/domain/network/types'
import type { SpanningTree } from '@/domain/topology/types'
import { maxAbs, maxAbsMatrix, multiply, rank, transpose, type Vector } from '@/engine/numerical'
import {
  fundamentalCircuitMatrix,
  fundamentalCircuits,
  fundamentalCutSetMatrix,
  incidenceData,
  suggestSpanningTree,
  validateTree,
} from '@/engine/topology'

export const PASS_TOL = 1e-9
export const WARN_TOL = 1e-6

export function classify(residual: number, scale: number): CheckStatus {
  if (!Number.isFinite(residual)) return 'fail'
  const s = Math.max(1, scale)
  if (residual <= PASS_TOL * s) return 'pass'
  if (residual <= WARN_TOL * s) return 'warning'
  return 'fail'
}

export interface VerificationInput {
  net: Network
  /** Branch voltages / currents in natural branch order. */
  v: Vector
  i: Vector
  /** Tree used by the analysis (if any). */
  tree?: SpanningTree | null
  solverResidual?: number
  solverScale?: number
}

/**
 * Verification engine: every check is computed from the actual solution
 * vectors. Nothing is asserted without a residual.
 */
export function verify(input: VerificationInput): VerificationReport {
  const { net, v, i } = input
  const checks: VerificationCheck[] = []
  const scale = Math.max(1, maxAbs(v), maxAbs(i))
  const nodeIds = net.nodes.map((n) => n.id)

  /* KCL on ALL nodes: Aa i = 0 */
  const Aa = incidenceData(net, nodeIds)
  const kclRes = Aa.map((row) => row.reduce((s, a, k) => s + a * i[k], 0))
  const kclMax = maxAbs(kclRes)
  checks.push({
    id: 'kcl',
    title: 'Kirchhoff’s Current Law',
    status: classify(kclMax, scale),
    residual: kclMax,
    tolerance: PASS_TOL * scale,
    relation: 'A_a\\,i = 0',
    detail: `Sum of currents leaving each of the ${net.nodes.length} nodes (including the reference node).`,
    items: net.nodes.map((n, r) => ({ label: n.label, ref: `n${r + 1}`, residual: Math.abs(kclRes[r]) })),
  })

  /* KVL on the f-circuits of the analysis tree (or a suggested tree) */
  const kvlTree = input.tree ?? suggestSpanningTree(net)
  if (kvlTree) {
    const circuits = fundamentalCircuits(net, kvlTree)
    const items = circuits.map((c) => {
      const res = Object.entries(c.entries).reduce((s, [bid, e]) => s + e * v[net.branches.findIndex((b) => b.id === bid)], 0)
      const link = net.branches.find((b) => b.id === c.linkId)!
      return { label: `f-circuit of ${link.label}`, ref: `l${link.index}`, residual: Math.abs(res) }
    })
    const kvlMax = items.reduce((m, x) => Math.max(m, x.residual), 0)
    checks.push({
      id: 'kvl',
      title: 'Kirchhoff’s Voltage Law',
      status: classify(kvlMax, scale),
      residual: kvlMax,
      tolerance: PASS_TOL * scale,
      relation: 'B_f\\,v = 0',
      detail: input.tree
        ? `Algebraic sum of branch voltages around each of the ${circuits.length} f-circuits of the selected tree. These span every loop of the graph.`
        : `Algebraic sum of branch voltages around each of the ${circuits.length} f-circuits of an automatically chosen tree. These span every loop of the graph.`,
      items,
    })
  }

  /* Element relations */
  const elemItems = net.branches.map((b, k) => {
    const s = b.polarity
    const val = b.element.value
    let res = 0
    let expression = ''
    if (b.element.type === 'resistor') {
      res = v[k] - val * i[k]
      expression = `v${b.index} − R·i${b.index}`
    } else if (b.element.type === 'voltageSource') {
      res = v[k] - s * val
      expression = `v${b.index} − (${s > 0 ? '' : '−'}E)`
    } else {
      res = i[k] - s * val
      expression = `i${b.index} − (${s > 0 ? '' : '−'}I)`
    }
    return { label: `${b.label} (${b.elementLabel})`, ref: `b${b.index}`, residual: Math.abs(res), expression }
  })
  const elemMax = elemItems.reduce((m, x) => Math.max(m, x.residual), 0)
  checks.push({
    id: 'element',
    title: 'Element relations',
    status: classify(elemMax, scale),
    residual: elemMax,
    tolerance: PASS_TOL * scale,
    relation: 'v_k = R_k i_k,\\quad v_k = s E_k,\\quad i_k = s I_k',
    detail: 'Each branch satisfies its constitutive relation under the passive sign convention.',
    items: elemItems,
  })

  /* Tellegen: Σ vₖ iₖ = 0 */
  const products = net.branches.map((_, k) => v[k] * i[k])
  const tellegen = products.reduce((s, p) => s + p, 0)
  const absSum = products.reduce((s, p) => s + Math.abs(p), 0)
  checks.push({
    id: 'tellegen',
    title: 'Tellegen’s theorem',
    status: classify(Math.abs(tellegen), absSum),
    residual: Math.abs(tellegen),
    tolerance: PASS_TOL * Math.max(1, absSum),
    relation: '\\sum_{k=1}^{b} v_k\\, i_k = v^{T} i = 0',
    detail: `Σ vₖiₖ over all ${net.branches.length} branches from the computed solution. Total absorbed power ${fmt(products.filter((p) => p > 0).reduce((a, b) => a + b, 0))} W, total delivered power ${fmt(-products.filter((p) => p < 0).reduce((a, b) => a + b, 0))} W.`,
    items: net.branches.map((b, k) => ({ label: `${b.label}: v${b.index}·i${b.index}`, ref: `b${b.index}`, residual: products[k] })),
  })

  /* Tree validity + orthogonality (only when the method uses a tree) */
  if (input.tree) {
    const tv = validateTree(net, input.tree.twigIds)
    checks.push({
      id: 'tree',
      title: 'Tree validity',
      status: tv.valid ? 'pass' : 'fail',
      residual: null,
      tolerance: null,
      relation: '|T| = n-1,\\ \\text{connected},\\ \\text{acyclic}',
      detail: tv.valid
        ? `${tv.selected} twigs = n − 1, every one of the ${tv.totalNodes} nodes is covered, connected, no cycle.`
        : tv.issues.map((x) => x.message).join(' '),
    })
    const ref = net.nodes[net.nodes.length - 1].id
    const A = incidenceData(
      net,
      nodeIds.filter((id) => id !== ref),
    )
    const Bf = fundamentalCircuitMatrix(net, input.tree).data
    const Qf = fundamentalCutSetMatrix(net, input.tree).data
    const b = net.branches.length
    const aBt = multiply(A, transpose(Bf, b), { aCols: b, bCols: Bf.length })
    const qBt = multiply(Qf, transpose(Bf, b), { aCols: b, bCols: Bf.length })
    const ra = maxAbsMatrix(aBt)
    const rq = maxAbsMatrix(qBt)
    checks.push({
      id: 'orthogonality-a',
      title: 'Orthogonality A·Bfᵀ',
      status: classify(ra, 1),
      residual: ra,
      tolerance: PASS_TOL,
      relation: 'A\\,B_f^{T} = 0',
      detail: 'Internal consistency check (17.5-2): every f-circuit passes through each node an even number of times with opposite incidence signs.',
    })
    checks.push({
      id: 'orthogonality-q',
      title: 'Orthogonality Qf·Bfᵀ',
      status: classify(rq, 1),
      residual: rq,
      tolerance: PASS_TOL,
      relation: 'Q_f\\,B_f^{T} = 0',
      detail: 'Internal consistency check (§17.8.5): f-cut-sets and f-circuits of the same tree are orthogonal.',
    })
    const n = net.nodes.length
    const dimsOk =
      A.length === n - 1 &&
      Bf.length === b - n + 1 &&
      Qf.length === n - 1 &&
      rank(A) === n - 1 &&
      (Bf.length === 0 || rank(Bf) === b - n + 1) &&
      rank(Qf) === n - 1
    checks.push({
      id: 'dimensions',
      title: 'Matrix dimensions and rank',
      status: dimsOk ? 'pass' : 'fail',
      residual: null,
      tolerance: null,
      relation: '\\operatorname{rank} A = \\operatorname{rank} Q_f = n-1,\\ \\operatorname{rank} B_f = b-n+1',
      detail: `A: ${A.length}×${b}, Bf: ${Bf.length}×${b}, Qf: ${Qf.length}×${b} for n = ${n}, b = ${b}.`,
    })
  }

  if (input.solverResidual !== undefined) {
    const s = Math.max(1, input.solverScale ?? scale)
    checks.push({
      id: 'residual',
      title: 'Numerical residual',
      status: classify(input.solverResidual, s),
      residual: input.solverResidual,
      tolerance: PASS_TOL * s,
      relation: '\\lVert M x - r \\rVert_\\infty',
      detail: 'Infinity-norm of the residual of the solved linear system.',
    })
  }

  const order: CheckStatus[] = ['fail', 'warning', 'pass']
  const overall = order.find((st) => checks.some((c) => c.status === st)) ?? 'pass'
  return { checks, overall }
}

const fmt = (x: number) => (Math.abs(x) < 1e-12 ? '0' : Number(x.toPrecision(4)).toString())
