import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runAnalysis } from '@/engine/solvers'
import { buildReport } from '@/engine/reporting/pdfReport'
import { renderSchematicSvg } from '@/engine/reporting/schematicSvg'
import { deriveNetwork } from '@/domain/network/derive'
import { EXAMPLES, exampleSchematic } from '@/examples'
import { branchIds, expectOk, nodeId } from '@/tests/helpers'

const font = (f: string) => readFileSync(path.resolve(process.cwd(), 'src/assets/fonts', f)).toString('base64')

const REQUIRED = [
  'Title',
  'Problem statement',
  'Circuit diagram',
  'Network summary',
  'Node table',
  'Branch table',
  'Element table',
  'Reference node',
  'Selected method',
  'Tree',
  'Twigs',
  'Links',
  'Matrices',
  'Equations',
  'Step-by-step calculation',
  'Node voltages',
  'Branch currents',
  'Branch voltages',
  'Power',
  'Verification',
  'Tellegen',
  'Final circuit',
  'Oscilloscope',
  'Conclusion',
]

describe('PDF report', () => {
  const ex = EXAMPLES.find((e) => e.id === 'bf-demo')!
  const s = exampleSchematic(ex)
  const net = deriveNetwork(s)
  const r = expectOk(runAnalysis('loop', net, { treeBranchIds: branchIds(net, ex.treeLabels!) }))

  it('contains every required section, in order, from the real result (Unicode fonts)', () => {
    const { doc, outline } = buildReport({
      projectName: 'Test',
      problem: ex.problem,
      net,
      result: r,
      fonts: { regular: font('DejaVuSans.ttf'), bold: font('DejaVuSans-Bold.ttf'), mono: font('DejaVuSansMono.ttf') },
    })
    expect(outline).toEqual(REQUIRED)
    expect(doc.getNumberOfPages()).toBeGreaterThan(2)
    const bytes = doc.output('arraybuffer')
    expect(bytes.byteLength).toBeGreaterThan(10_000)
  })

  it('falls back to built-in fonts with ASCII-safe text', () => {
    const n2 = deriveNetwork(exampleSchematic(EXAMPLES[0]))
    const r2 = expectOk(runAnalysis('nodal', n2, { referenceNodeId: nodeId(n2, 'G') }))
    const { outline } = buildReport({ projectName: 'X', problem: '', net: n2, result: r2 })
    expect(outline).toEqual(REQUIRED)
  })

  it('renders the schematic SVG from the domain model with results', () => {
    const { svg, width, height } = renderSchematicSvg(s, net, { result: r, showResults: true })
    expect(width).toBeGreaterThan(100)
    expect(height).toBeGreaterThan(100)
    expect(svg).toContain('<svg')
    expect(svg).toContain('i₅ = 1.00 A')
  })
})
