import { toast } from 'sonner'
import { emptySchematic } from '@/domain/schematic/types'
import { FILE_EXTENSION, parseProjectFile, serializeProject, type ProjectFile } from '@/domain/project/schema'
import { deriveNetwork } from '@/domain/network/derive'
import { EXAMPLES, exampleSchematic, type Example } from '@/examples'
import { uid } from '@/lib/id'
import { deleteProject, loadProject, saveProject, writeAutosave } from '@/persistence/db'
import { useAnalysisStore } from '@/store/analysisStore'
import { useCircuitStore } from '@/store/circuitStore'
import { useProjectStore } from '@/store/projectStore'
import { useUiStore } from '@/store/uiStore'

export function currentProjectFile(): ProjectFile {
  const p = useProjectStore.getState()
  const a = useAnalysisStore.getState()
  return serializeProject(
    { id: p.projectId, name: p.name, description: p.description, createdAt: p.createdAt, updatedAt: Date.now() },
    useCircuitStore.getState().schematic,
    { method: a.method, referenceNodeId: a.referenceNodeId, treeBranchIds: a.treeBranchIds },
  )
}

function applyFile(file: ProjectFile) {
  useCircuitStore.getState().load(file.network)
  useProjectStore.getState().setMeta({ projectId: file.project.id, name: file.project.name, description: file.project.description, createdAt: file.project.createdAt })
  useAnalysisStore.getState().restore({ method: file.analysis.method, referenceNodeId: file.analysis.referenceNodeId, treeBranchIds: file.analysis.treeBranchIds })
  const ui = useUiStore.getState()
  ui.select([])
  ui.setHighlight(null)
  ui.setMode('edit')
  ui.requestFitView()
}

export function newProject() {
  useCircuitStore.getState().load(emptySchematic())
  useProjectStore.getState().setMeta({ projectId: uid('p'), name: 'Untitled network', description: '', createdAt: Date.now() })
  useAnalysisStore.getState().reset()
  const ui = useUiStore.getState()
  ui.select([])
  ui.setHighlight(null)
  ui.setMode('edit')
  toast.success('New empty project. Drag components from the toolbox to start.')
}

export async function saveCurrentProject(): Promise<void> {
  const file = currentProjectFile()
  useProjectStore.getState().setSaveStatus('saving')
  try {
    await saveProject(file)
    await writeAutosave(file)
    useProjectStore.getState().setSaveStatus('saved')
    toast.success(`Saved “${file.project.name}” to this browser.`)
  } catch (e) {
    useProjectStore.getState().setSaveStatus('error', (e as Error).message)
    toast.error(`Save failed: ${(e as Error).message}`)
  }
}

export async function openStoredProject(id: string): Promise<void> {
  const file = await loadProject(id)
  if (!file) {
    toast.error('That project could not be found.')
    return
  }
  const parsed = parseProjectFile(file)
  if (!parsed.ok) {
    toast.error(`Stored project is invalid: ${parsed.errors.join('; ')}`)
    return
  }
  applyFile(parsed.file)
  toast.success(`Opened “${parsed.file.project.name}”.`)
}

export async function removeStoredProject(id: string): Promise<void> {
  await deleteProject(id)
}

export function restoreFromAutosave(file: ProjectFile): boolean {
  const parsed = parseProjectFile(file)
  if (!parsed.ok) return false
  applyFile(parsed.file)
  return true
}

export function exportProjectJson() {
  const file = currentProjectFile()
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${file.project.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'network'}${FILE_EXTENSION}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast.success(`Exported ${a.download}`)
}

export async function importProjectFile(f: File): Promise<boolean> {
  const text = await f.text()
  const parsed = parseProjectFile(text)
  if (!parsed.ok) {
    toast.error('Invalid project file', { description: parsed.errors.join(' · ') })
    return false
  }
  // Imported projects get a fresh id so they never overwrite a stored project silently.
  const file = { ...parsed.file, project: { ...parsed.file.project, id: uid('p') } }
  applyFile(file)
  toast.success(`Imported “${file.project.name}”.`)
  return true
}

export function loadExample(ex: Example) {
  const schematic = exampleSchematic(ex)
  const net = deriveNetwork(schematic)
  const refId = net.nodes.find((n) => n.label === ex.referenceLabel)?.id ?? null
  const tree = ex.treeLabels ? ex.treeLabels.map((l) => net.branches.find((b) => b.elementLabel === l)!.id) : []
  useCircuitStore.getState().load(schematic)
  useProjectStore.getState().setMeta({ projectId: uid('p'), name: ex.title, description: ex.problem, createdAt: Date.now() })
  // The method is pre-selected but NOT run: the user still confirms the configuration.
  useAnalysisStore.getState().restore({ method: ex.method, referenceNodeId: refId, treeBranchIds: tree })
  const ui = useUiStore.getState()
  ui.select([])
  ui.setHighlight(null)
  ui.setMode('edit')
  ui.setRightTab('analysis')
  ui.requestFitView()
  toast.success(`Loaded example: ${ex.title}`, { description: 'The recommended method is pre-selected. Review the configuration and run the analysis.' })
}

export { EXAMPLES }
