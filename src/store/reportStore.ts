import { create } from 'zustand'

export interface ReportState {
  status: 'idle' | 'generating' | 'done' | 'error'
  message: string | null
  setStatus(status: ReportState['status'], message?: string | null): void
}

export const useReportStore = create<ReportState>((set) => ({
  status: 'idle',
  message: null,
  setStatus: (status, message = null) => set({ status, message }),
}))
