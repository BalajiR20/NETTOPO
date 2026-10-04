import { create } from 'zustand'
import type { ScopeChannel } from '@/engine/simulation'

export type Channel = ScopeChannel

export interface SimulationState {
  channels: Channel[]
  running: boolean
  /** Seconds per horizontal division. */
  timePerDiv: number
  /** Simulation time at the sweep origin (s). */
  time: number
  resetNonce: number

  setChannel(id: Channel['id'], patch: Partial<Channel>): void
  setRunning(r: boolean): void
  setTimePerDiv(t: number): void
  advance(dt: number): void
  reset(): void
}

export const CHANNEL_COLORS = ['#e8b400', '#22c3e6', '#e2489a', '#4ade80']

export const useSimulationStore = create<SimulationState>((set) => ({
  channels: [
    { id: 1, enabled: true, quantity: 'branch-current', targetId: null, scale: 0, offset: 0, color: CHANNEL_COLORS[0] },
    { id: 2, enabled: true, quantity: 'branch-voltage', targetId: null, scale: 0, offset: 0, color: CHANNEL_COLORS[1] },
    { id: 3, enabled: true, quantity: 'node-voltage', targetId: null, scale: 0, offset: 0, color: CHANNEL_COLORS[2] },
    { id: 4, enabled: false, quantity: 'branch-power', targetId: null, scale: 0, offset: 0, color: CHANNEL_COLORS[3] },
  ],
  running: true,
  timePerDiv: 1e-3,
  time: 0,
  resetNonce: 0,
  setChannel: (id, patch) => set((st) => ({ channels: st.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  setRunning: (running) => set({ running }),
  setTimePerDiv: (timePerDiv) => set({ timePerDiv }),
  advance: (dt) => set((st) => ({ time: st.time + dt })),
  reset: () => set((st) => ({ time: 0, resetNonce: st.resetNonce + 1 })),
}))
