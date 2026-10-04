import { expect, test, type Page } from '@playwright/test'

/** Fresh browser storage for every test, so no autosave from a previous run leaks in. */
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e
  })
  await page.goto('/')
  await page.evaluate(() => new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('nettopo')
    r.onsuccess = r.onerror = r.onblocked = () => res()
  }))
  await page.reload()
  await expect(page.getByTestId('circuit-canvas')).toBeVisible()
})

async function newProject(page: Page) {
  await page.getByTestId('btn-new').click()
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
}

const handle = (page: Page, nodeId: string, pin: string) => page.locator(`.react-flow__node[data-id="${nodeId}"] .react-flow__handle[data-handleid="${pin}"]`)

async function addAt(page: Page, tool: string, x: number, y: number): Promise<string> {
  const canvas = page.getByTestId('circuit-canvas')
  const before = await page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
  await page.getByTestId(`tool-${tool}`).dragTo(canvas, { targetPosition: { x, y } })
  await expect(page.locator('.react-flow__node')).toHaveCount(before.length + 1)
  const after = await page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
  return after.find((id) => !before.includes(id))!
}

async function wire(page: Page, a: [string, string], b: [string, string]) {
  const edges = await page.locator('.react-flow__edge').count()
  await handle(page, a[0], a[1]).dragTo(handle(page, b[0], b[1]), { force: true })
  await expect(page.locator('.react-flow__edge')).toHaveCount(edges + 1)
}

test('create a circuit, select nodal analysis and a reference node, and see the result', async ({ page }) => {
  await newProject(page)
  const v = await addAt(page, 'voltageSource', 300, 300)
  const r1 = await addAt(page, 'resistor', 520, 160)
  const r2 = await addAt(page, 'resistor', 740, 300)
  const g = await addAt(page, 'ground', 520, 460)
  await wire(page, [v, 'a'], [r1, 'a'])
  await wire(page, [r1, 'b'], [r2, 'a'])
  await wire(page, [r2, 'b'], [g, 'p'])
  await wire(page, [v, 'b'], [g, 'p'])

  const status = page.getByTestId('network-status')
  await expect(status).toContainText('Nodes (n)3')
  await expect(status).toContainText('Branches (b)3')

  await page.getByTestId('btn-analyze').click()
  await page.getByTestId('method-nodal').click()
  await expect(page.getByTestId('active-method')).toHaveText('Nodal Analysis')
  await page.getByTestId('ref-GND').click()
  await page.getByTestId('run-analysis').click()
  await expect(page.getByTestId('step-verify')).toBeVisible()

  await page.getByTestId('tab-results').click()
  // 10 V across 10 Ω + 10 Ω (defaults): 0.5 A in every branch.
  await expect(page.getByText('500.0 mA').first()).toBeVisible()
  await page.getByTestId('tab-verification').click()
  await expect(page.getByTestId('verification-list')).toContainText('Tellegen')
})

test('signature flow: Bf → tree selection → matrix ↔ circuit → equations → oscilloscope → PDF', async ({ page }) => {
  await page.getByRole('button', { name: 'File and examples' }).click()
  await page.getByTestId('example-bf-demo').click()
  await page.getByTestId('btn-analyze').click()
  await page.getByTestId('method-fcircuit').click()
  await expect(page.getByTestId('mode-banner')).toContainText('TREE SELECTION MODE')
  await page.getByTestId('tab-analysis').click()
  await page.getByTestId('suggest-tree').click()
  const tree = page.getByTestId('tree-status')
  await expect(tree).toContainText('6 / 6 required branches')
  await expect(tree).toContainText('VALID')
  await page.getByTestId('confirm-tree').click()
  await expect(page.getByTestId('step-verify')).toBeVisible()

  await page.getByTestId('tab-matrix').click()
  await expect(page.getByTestId('matrix-Bf')).toBeVisible()
  // Suggested tree = {V1..V4, R1, R3}: links b6, b8, b9 define the f-circuits.
  await page.getByRole('button', { name: /^Row f-circuit \(b6\)/ }).click()
  await expect(page.getByText('Highlighted: f-circuit of link b6')).toBeVisible()

  await page.getByTestId('tab-equations').click()
  await page.locator('.nt-tex [data-ref="b2"]').first().click()
  await expect(page.getByText(/Highlighted: b2 \(V2\)/)).toBeVisible()

  await page.getByTestId('tab-oscilloscope').click()
  await expect(page.getByTestId('oscilloscope')).toContainText('CH1')
  await page.getByTestId('tab-verification').click()
  await expect(page.getByTestId('verification-list')).not.toContainText('FAIL')

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('btn-export-pdf').click()])
  expect(download.suggestedFilename()).toMatch(/fcircuit-report\.pdf$/)
})

test('error states are explained', async ({ page }) => {
  await newProject(page)
  await addAt(page, 'resistor', 400, 300)
  await expect(page.getByTestId('network-status')).toContainText('not connected to anything')
  await page.getByTestId('btn-analyze').click()
  await page.getByTestId('method-nodal').click()
  await page.getByTestId('tab-analysis').click()
  await expect(page.getByTestId('run-analysis')).toBeDisabled()
  await expect(page.getByText(/Select a reference node before running nodal analysis/)).toBeVisible()
})

test('save, start a new project and reopen the saved one', async ({ page }) => {
  await page.getByRole('button', { name: 'File and examples' }).click()
  await page.getByTestId('example-two-loop').click()
  await page.getByTestId('btn-save').click()
  await expect(page.getByTestId('save-status')).toHaveText('Saved')
  await newProject(page)
  await page.getByTestId('btn-open').click()
  await page.getByRole('button', { name: 'Open' }).first().click()
  await expect(page.locator('.react-flow__node')).not.toHaveCount(0)
})
