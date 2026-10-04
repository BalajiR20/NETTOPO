import Dexie, { type EntityTable } from 'dexie'
import type { ProjectFile } from '@/domain/project/schema'

export interface StoredProject {
  id: string
  name: string
  updatedAt: number
  file: ProjectFile
}

export interface StoredSetting {
  key: string
  value: unknown
}

export interface AutosaveEntry {
  key: 'current'
  savedAt: number
  file: ProjectFile
}

class NettopoDB extends Dexie {
  projects!: EntityTable<StoredProject, 'id'>
  settings!: EntityTable<StoredSetting, 'key'>
  autosave!: EntityTable<AutosaveEntry, 'key'>
  constructor() {
    super('nettopo')
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      settings: 'key',
      autosave: 'key',
    })
  }
}

export const db = new NettopoDB()

export async function saveProject(file: ProjectFile): Promise<void> {
  await db.projects.put({ id: file.project.id, name: file.project.name, updatedAt: file.project.updatedAt, file })
}

export async function listProjects(limit = 50): Promise<StoredProject[]> {
  return db.projects.orderBy('updatedAt').reverse().limit(limit).toArray()
}

export async function loadProject(id: string): Promise<ProjectFile | undefined> {
  return (await db.projects.get(id))?.file
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id)
}

export async function writeAutosave(file: ProjectFile): Promise<void> {
  await db.autosave.put({ key: 'current', savedAt: Date.now(), file })
}

export async function readAutosave(): Promise<AutosaveEntry | undefined> {
  return db.autosave.get('current')
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}
