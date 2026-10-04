import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { currentProjectFile, loadExample, restoreFromAutosave } from '@/app/projectActions'
import { EXAMPLES } from '@/examples'
import { getSetting, readAutosave, saveProject, setSetting, writeAutosave } from '@/persistence/db'
import { useAnalysisStore } from '@/store/analysisStore'
import { useCircuitStore } from '@/store/circuitStore'
import { useProjectStore } from '@/store/projectStore'
import { useUiStore } from '@/store/uiStore'
import { getNetwork } from './useNetwork'

/** Keeps analysis state consistent with the derived network (invalidation policy). */
export function useAnalysisSync() {
  useEffect(() => {
    let last = useCircuitStore.getState().schematic
    return useCircuitStore.subscribe((st) => {
      if (st.schematic === last) return
      last = st.schematic
      useAnalysisStore.getState().onNetworkChanged(getNetwork(st.schematic))
    })
  }, [])
}

/** Restores the last session on startup (or loads a first example), then autosaves. */
export function usePersistence() {
  const ready = useRef(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const settings = await getSetting<Partial<ReturnType<typeof useUiStore.getState>>>('ui')
        if (settings && !cancelled) {
          useUiStore.getState().setSettings({
            theme: settings.theme ?? useUiStore.getState().theme,
            highContrast: settings.highContrast ?? false,
            snapToGrid: settings.snapToGrid ?? true,
            showGrid: settings.showGrid ?? true,
            precision: settings.precision ?? 4,
          })
        } else if (!settings && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
          useUiStore.getState().setSettings({ theme: 'dark' })
        }
        const auto = await readAutosave()
        if (cancelled) return
        if (auto && restoreFromAutosave(auto.file)) {
          toast.message('Restored your last session', { description: `“${auto.file.project.name}”, autosaved ${new Date(auto.savedAt).toLocaleString()}` })
        } else {
          loadExample(EXAMPLES[1])
        }
      } catch {
        loadExample(EXAMPLES[1])
      } finally {
        useProjectStore.getState().setSaveStatus('saved')
        ready.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Autosave: 800 ms after the last change to the circuit, analysis configuration or project name.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (!ready.current) return
      useProjectStore.getState().setSaveStatus('unsaved')
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        useProjectStore.getState().setSaveStatus('saving')
        try {
          const file = currentProjectFile()
          await writeAutosave(file)
          await saveProject(file)
          useProjectStore.getState().setSaveStatus('saved')
        } catch (e) {
          useProjectStore.getState().setSaveStatus('error', (e as Error).message)
        }
      }, 800)
    }
    const u1 = useCircuitStore.subscribe((s, p) => s.schematic !== p.schematic && schedule())
    const u2 = useAnalysisStore.subscribe((s, p) => (s.method !== p.method || s.referenceNodeId !== p.referenceNodeId || s.treeBranchIds !== p.treeBranchIds) && schedule())
    const u3 = useProjectStore.subscribe((s, p) => (s.name !== p.name || s.description !== p.description) && schedule())
    const flush = () => {
      if (useProjectStore.getState().saveStatus === 'unsaved') void writeAutosave(currentProjectFile())
    }
    window.addEventListener('beforeunload', flush)
    return () => {
      u1()
      u2()
      u3()
      window.removeEventListener('beforeunload', flush)
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Persist UI settings.
  useEffect(
    () =>
      useUiStore.subscribe((s, p) => {
        if (s.theme !== p.theme || s.highContrast !== p.highContrast || s.snapToGrid !== p.snapToGrid || s.showGrid !== p.showGrid || s.precision !== p.precision) {
          void setSetting('ui', { theme: s.theme, highContrast: s.highContrast, snapToGrid: s.snapToGrid, showGrid: s.showGrid, precision: s.precision })
        }
      }),
    [],
  )
}

/** Applies theme / high-contrast classes to <html>. */
export function useThemeClass() {
  const theme = useUiStore((s) => s.theme)
  const hc = useUiStore((s) => s.highContrast)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('hc', hc)
  }, [theme, hc])
}
