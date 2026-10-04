import { create } from 'zustand'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export interface ProjectState {
  projectId: string
  name: string
  description: string
  createdAt: number
  saveStatus: SaveStatus
  lastSavedAt: number | null
  saveError: string | null
  setMeta(patch: Partial<Pick<ProjectState, 'projectId' | 'name' | 'description' | 'createdAt'>>): void
  setSaveStatus(s: SaveStatus, error?: string | null): void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectId: 'working',
  name: 'Untitled network',
  description: '',
  createdAt: Date.now(),
  saveStatus: 'saved',
  lastSavedAt: null,
  saveError: null,
  setMeta: (patch) => set(patch),
  setSaveStatus: (saveStatus, saveError = null) => set((st) => ({ saveStatus, saveError, lastSavedAt: saveStatus === 'saved' ? Date.now() : st.lastSavedAt })),
}))
