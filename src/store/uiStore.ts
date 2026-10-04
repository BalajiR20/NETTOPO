import { create } from 'zustand'

/** What is highlighted across canvas ↔ matrix ↔ equations. Tokens: b<k>, n<j>, l<k>, t<k>. */
export interface Highlight {
  token: string
  /** Where it originated (to avoid feedback loops and for focus styling). */
  source: 'canvas' | 'matrix-row' | 'matrix-col' | 'equation' | 'list' | 'graph'
}

export type InteractionMode = 'edit' | 'reference' | 'tree'
export type BottomTab = 'explorer' | 'equations' | 'matrix' | 'results' | 'verification' | 'oscilloscope'
export type RightTab = 'properties' | 'analysis'
export type Theme = 'light' | 'dark'

export interface DisplayOptions {
  currents: boolean
  voltages: boolean
  power: boolean
  flow: boolean
  values: boolean
  orientation: boolean
}

export interface UiState {
  mode: InteractionMode
  selection: string[]
  highlight: Highlight | null
  display: DisplayOptions
  canvasView: 'schematic' | 'graph'
  bottomTab: BottomTab
  rightTab: RightTab
  bottomOpen: boolean
  leftOpen: boolean
  rightOpen: boolean
  theme: Theme
  highContrast: boolean
  snapToGrid: boolean
  showGrid: boolean
  precision: number
  dialogs: { methods: boolean; settings: boolean; open: boolean; compare: boolean; shortcuts: boolean; newProject: boolean }
  /** Bumped to ask the canvas to fit the view (after loading an example). */
  fitViewNonce: number

  setMode(m: InteractionMode): void
  select(ids: string[]): void
  setHighlight(h: Highlight | null): void
  toggleHighlight(h: Highlight): void
  setDisplay(patch: Partial<DisplayOptions>): void
  setCanvasView(v: UiState['canvasView']): void
  setBottomTab(t: BottomTab): void
  setRightTab(t: RightTab): void
  setPanel(panel: 'bottomOpen' | 'leftOpen' | 'rightOpen', open: boolean): void
  setDialog(d: keyof UiState['dialogs'], open: boolean): void
  setSettings(patch: Partial<Pick<UiState, 'theme' | 'highContrast' | 'snapToGrid' | 'showGrid' | 'precision'>>): void
  requestFitView(): void
}

export const useUiStore = create<UiState>((set) => ({
  mode: 'edit',
  selection: [],
  highlight: null,
  display: { currents: true, voltages: true, power: false, flow: false, values: true, orientation: true },
  canvasView: 'schematic',
  bottomTab: 'explorer',
  rightTab: 'analysis',
  bottomOpen: true,
  leftOpen: true,
  rightOpen: true,
  theme: 'light',
  highContrast: false,
  snapToGrid: true,
  showGrid: true,
  precision: 4,
  dialogs: { methods: false, settings: false, open: false, compare: false, shortcuts: false, newProject: false },
  fitViewNonce: 0,

  setMode: (mode) => set({ mode }),
  select: (selection) => set({ selection }),
  setHighlight: (highlight) => set({ highlight }),
  toggleHighlight: (h) => set((st) => ({ highlight: st.highlight?.token === h.token ? null : h })),
  setDisplay: (patch) => set((st) => ({ display: { ...st.display, ...patch } })),
  setCanvasView: (canvasView) => set({ canvasView }),
  setBottomTab: (bottomTab) => set({ bottomTab, bottomOpen: true }),
  setRightTab: (rightTab) => set({ rightTab, rightOpen: true }),
  setPanel: (panel, open) => set({ [panel]: open } as Partial<UiState>),
  setDialog: (d, open) => set((st) => ({ dialogs: { ...st.dialogs, [d]: open } })),
  setSettings: (patch) => set(patch),
  requestFitView: () => set((st) => ({ fitViewNonce: st.fitViewNonce + 1 })),
}))
