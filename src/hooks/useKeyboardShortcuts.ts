import { useEffect } from 'react'
import { saveCurrentProject } from '@/app/projectActions'
import { canvasApi } from '@/components/circuit/canvasApi'
import { useCircuitStore } from '@/store/circuitStore'
import { useUiStore } from '@/store/uiStore'

export const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Delete', 'Backspace'], action: 'Delete selection' },
  { keys: ['Ctrl', 'Z'], action: 'Undo' },
  { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo (also Ctrl+Y)' },
  { keys: ['Ctrl', 'S'], action: 'Save project' },
  { keys: ['Ctrl', 'C'], action: 'Copy selection' },
  { keys: ['Ctrl', 'V'], action: 'Paste' },
  { keys: ['Ctrl', 'A'], action: 'Select all' },
  { keys: ['R'], action: 'Rotate selected component' },
  { keys: ['O'], action: 'Reverse branch orientation' },
  { keys: ['W'], action: 'Toggle wire tool' },
  { keys: ['+'], action: 'Zoom in' },
  { keys: ['−'], action: 'Zoom out' },
  { keys: ['F'], action: 'Fit circuit to view' },
  { keys: ['G'], action: 'Toggle schematic / oriented-graph view' },
  { keys: ['Esc'], action: 'Leave tree / reference selection mode, clear selection & highlight' },
  { keys: ['?'], action: 'Show keyboard shortcuts' },
  { keys: ['Shift', 'drag'], action: 'Box-select on canvas' },
]

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.getAttribute('role') === 'combobox'
}

export function useKeyboardShortcuts(toggleWireTool: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      const ui = useUiStore.getState()
      const circuit = useCircuitStore.getState()
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveCurrentProject()
        return
      }
      if (isTyping(e)) return
      if (Object.values(ui.dialogs).some(Boolean)) return
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) circuit.redo()
        else circuit.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        circuit.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'c') {
        circuit.copy(ui.selection)
        return
      }
      if (mod && e.key.toLowerCase() === 'v') {
        const ids = circuit.paste()
        if (ids.length) ui.select(ids)
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        const s = circuit.schematic
        ui.select([...s.components, ...s.markers, ...s.grounds].map((x) => x.id))
        return
      }
      if (mod) return
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (ui.selection.length && ui.mode === 'edit') {
            e.preventDefault()
            circuit.deleteItems(ui.selection)
            ui.select([])
          }
          break
        case 'Escape':
          if (ui.mode !== 'edit') ui.setMode('edit')
          else {
            ui.select([])
            ui.setHighlight(null)
          }
          break
        case 'r':
        case 'R':
          circuit.rotate(ui.selection)
          break
        case 'o':
        case 'O':
          circuit.reverseOrientation(ui.selection)
          break
        case 'w':
        case 'W':
          toggleWireTool()
          break
        case '+':
        case '=':
          canvasApi.zoomIn()
          break
        case '-':
        case '_':
          canvasApi.zoomOut()
          break
        case 'f':
        case 'F':
          canvasApi.fitView()
          break
        case 'g':
        case 'G':
          ui.setCanvasView(ui.canvasView === 'schematic' ? 'graph' : 'schematic')
          break
        case '?':
          ui.setDialog('shortcuts', true)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleWireTool])
}
