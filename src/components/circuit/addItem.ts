import type { ElementKind } from '@/domain/elements'
import { useCircuitStore } from '@/store/circuitStore'
import { useUiStore } from '@/store/uiStore'

/** Adds a toolbox item at a flow position. */
export function addItem(kind: string, pos: { x: number; y: number }): string | null {
  const st = useCircuitStore.getState()
  let id: string | null = null
  if (kind === 'node' || kind === 'junction') id = st.addMarker(kind, pos)
  else if (kind === 'ground') id = st.addGround(pos)
  else if (kind === 'resistor' || kind === 'voltageSource' || kind === 'currentSource') id = st.addComponent(kind as ElementKind, pos)
  if (id) useUiStore.getState().select([id])
  return id
}
