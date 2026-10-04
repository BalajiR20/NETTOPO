import { describe, expect, it } from 'vitest'
import { parseProjectFile, serializeProject } from '@/domain/project/schema'
import { schematicFromGraph } from '@/domain/schematic/fromGraph'
import { listProjects, loadProject, readAutosave, saveProject, writeAutosave } from '@/persistence/db'
import { divider } from '@/tests/fixtures/textbook'

const meta = { id: 'p1', name: 'Divider', description: '', createdAt: 1, updatedAt: 2 }

describe('project files and IndexedDB persistence', () => {
  const file = serializeProject(meta, schematicFromGraph(divider), { method: 'nodal', referenceNodeId: null, treeBranchIds: [] })

  it('round-trips through JSON with validation', () => {
    const r = parseProjectFile(JSON.stringify(file))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.file).toEqual(file)
  })

  it('rejects invalid JSON, wrong schema and future versions with readable errors', () => {
    const a = parseProjectFile('{not json')
    expect(!a.ok && a.errors[0]).toMatch(/not valid JSON/)
    const b = parseProjectFile({ ...file, network: { ...file.network, components: [{ id: 'x' }] } })
    expect(b.ok).toBe(false)
    const c = parseProjectFile({ ...file, schemaVersion: 7 })
    expect(!c.ok && c.errors[0]).toMatch(/newer NETTOPO/)
    const d = parseProjectFile({ ...file, network: { ...file.network, components: file.network.components.map((x) => ({ ...x, value: 'ten' })) } })
    expect(d.ok).toBe(false)
  })

  it('saves, lists and loads projects; autosave persists the working copy', async () => {
    await saveProject(file)
    expect((await listProjects()).map((p) => p.id)).toContain('p1')
    expect(await loadProject('p1')).toEqual(file)
    await writeAutosave(file)
    expect((await readAutosave())?.file.project.name).toBe('Divider')
  })
})
