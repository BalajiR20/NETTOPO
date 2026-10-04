import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel'
import { MatrixTable } from '@/components/matrices/MatrixTable'
import { EquationsPanel } from '@/components/equations/EquationsPanel'
import { VerificationPanel } from '@/components/verification/VerificationPanel'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { loadExample } from '@/app/projectActions'
import { EXAMPLES } from '@/examples'
import { getNetwork } from '@/hooks/useNetwork'
import { runAnalysis } from '@/engine/solvers'
import { useAnalysisStore } from '@/store/analysisStore'
import { useCircuitStore } from '@/store/circuitStore'
import { useUiStore } from '@/store/uiStore'
import type { AnalysisResult } from '@/domain/analysis/types'

const wrap = (ui: React.ReactNode) => render(<TooltipProvider>{ui}</TooltipProvider>)

function loadAndSolve(id: string, method: AnalysisResult['method']) {
  const ex = EXAMPLES.find((e) => e.id === id)!
  act(() => loadExample(ex))
  const net = getNetwork(useCircuitStore.getState().schematic)
  const st = useAnalysisStore.getState()
  const r = runAnalysis(method, net, { referenceNodeId: st.referenceNodeId, treeBranchIds: st.treeBranchIds })
  if (!r.ok) throw new Error(r.errors[0].message)
  return { net, r }
}

describe('UI components', () => {
  beforeEach(() => {
    useUiStore.getState().setHighlight(null)
  })

  it('method selection → reference node → run produces step-by-step results', () => {
    act(() => loadExample(EXAMPLES[0]))
    act(() => useAnalysisStore.getState().selectMethod(null, getNetwork(useCircuitStore.getState().schematic)))
    act(() => useAnalysisStore.getState().setReference(null))
    wrap(<AnalysisPanel />)
    expect(screen.getByText(/No method-specific mathematics/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('method-nodal'))
    expect(screen.getByTestId('active-method')).toHaveTextContent('Nodal Analysis')
    expect(screen.getByTestId('run-analysis')).toBeDisabled()
    fireEvent.click(screen.getByTestId('ref-G'))
    fireEvent.click(screen.getByTestId('run-analysis'))
    expect(screen.getByTestId('step-nodes')).toBeInTheDocument()
    expect(screen.getByTestId('step-verify')).toBeInTheDocument()
    const out = useAnalysisStore.getState().outcome
    expect(out?.ok).toBe(true)
  })

  it('tree-based method shows live tree validation and confirms', () => {
    act(() => loadExample(EXAMPLES.find((e) => e.id === 'wheatstone')!))
    act(() => useAnalysisStore.getState().setTree([]))
    wrap(<AnalysisPanel />)
    const status = screen.getByTestId('tree-status')
    expect(within(status).getByText('0 / 3 required branches')).toBeInTheDocument()
    expect(within(status).getByText('INVALID')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('suggest-tree'))
    expect(within(screen.getByTestId('tree-status')).getByText('VALID')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-tree'))
    expect(useAnalysisStore.getState().outcome?.ok).toBe(true)
  })

  it('matrix column click highlights the branch; highlight reflects back on the column', () => {
    const { net, r } = loadAndSolve('bf-demo', 'fcircuit')
    const Bf = r.matrices.find((m) => m.id === 'Bf')!
    wrap(<MatrixTable matrix={Bf} net={net} result={r} />)
    fireEvent.click(screen.getByRole('button', { name: /Column b5/ }))
    expect(useUiStore.getState().highlight?.token).toBe('b5')
    fireEvent.click(screen.getByRole('button', { name: /^Row f-circuit \(b7\)/ }))
    expect(useUiStore.getState().highlight?.token).toBe('l7')
  })

  it('matrix entry click explains the value', () => {
    const { net, r } = loadAndSolve('bf-demo', 'fcircuit')
    const Bf = r.matrices.find((m) => m.id === 'Bf')!
    wrap(<MatrixTable matrix={Bf} net={net} result={r} />)
    fireEvent.click(screen.getByRole('button', { name: 'f-circuit (b5), b1: −1' }))
    expect(screen.getByRole('status')).toHaveTextContent(/twig b1 lies on the f-circuit of link b5 but is traversed against its orientation/)
  })

  it('clicking a variable in an equation highlights its branch', () => {
    const { r } = loadAndSolve('divider', 'nodal')
    const { container } = wrap(<EquationsPanel result={r} />)
    // Nodal equations are written in the node voltages: clicking vₙ highlights the node.
    const v = container.querySelector('.nt-tex [data-ref="n1"]') as HTMLElement
    expect(v).toBeTruthy()
    fireEvent.click(v)
    expect(useUiStore.getState().highlight?.token).toBe('n1')
  })

  it('verification and results panels render real residuals and values', () => {
    const { r } = loadAndSolve('textbook-17-4-1', 'nodal')
    wrap(<VerificationPanel result={r} />)
    expect(screen.getByText('Kirchhoff’s Current Law')).toBeInTheDocument()
    expect(screen.getAllByText('PASS').length).toBeGreaterThan(3)
    wrap(<ResultsPanel result={r} />)
    expect(screen.getAllByText('2.000 V').length).toBeGreaterThan(0)
    expect(screen.getAllByText('delivered').length).toBe(3)
  })
})
