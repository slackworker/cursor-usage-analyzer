import { create } from 'zustand'
import type { ActivityGranularity, FilterState, ReportMeta, UsageEvent } from '../lib/types'
import { DEFAULT_ACTIVITY_GRANULARITY, DEFAULT_POOL_LIMITS } from '../lib/types'
import { parseCsvText } from '../lib/parser'
import { getUserTimezone } from '../lib/timezone'

export interface ReportStore {
  fileName: string | null
  fileContent: string | null
  events: UsageEvent[]
  meta: ReportMeta | null
  filters: FilterState
  poolLimits: { autoComposer: number; api: number }
  showCumulative: boolean
  modelView: 'cost' | 'token'
  structureView: 'cost' | 'token'
  hourlyView: 'sessions' | 'tokens'
  hourlyGranularity: ActivityGranularity
  projectionOpen: boolean
  setCsvFile: (file: File) => Promise<void>
  clear: () => void
  setFilters: (patch: Partial<FilterState>) => void
  setPoolLimits: (patch: Partial<{ autoComposer: number; api: number }>) => void
  setShowCumulative: (v: boolean) => void
  setModelView: (v: 'cost' | 'token') => void
  setStructureView: (v: 'cost' | 'token') => void
  setHourlyView: (v: 'sessions' | 'tokens') => void
  setHourlyGranularity: (v: ActivityGranularity) => void
  setProjectionOpen: (v: boolean) => void
}

const defaultFilters: FilterState = {
  dateRange: 'all',
  billingMode: 'standard',
  models: 'all',
}

export const useReportStore = create<ReportStore>((set) => ({
  fileName: null,
  fileContent: null,
  events: [],
  meta: null,
  filters: defaultFilters,
  poolLimits: { ...DEFAULT_POOL_LIMITS },
  showCumulative: false,
  modelView: 'cost',
  structureView: 'token',
  hourlyView: 'sessions',
  hourlyGranularity: DEFAULT_ACTIVITY_GRANULARITY,
  projectionOpen: false,

  setCsvFile: async (file: File) => {
    const content = await file.text()
    const { events, meta } = parseCsvText(content, file.name, getUserTimezone())
    set({
      fileName: file.name,
      fileContent: content,
      events,
      meta,
    })
  },

  clear: () =>
    set({
      fileName: null,
      fileContent: null,
      events: [],
      meta: null,
      filters: { ...defaultFilters },
      poolLimits: { ...DEFAULT_POOL_LIMITS },
      showCumulative: false,
      modelView: 'cost',
      structureView: 'token',
      hourlyView: 'sessions',
      hourlyGranularity: DEFAULT_ACTIVITY_GRANULARITY,
      projectionOpen: false,
    }),

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

  setPoolLimits: (patch) => set((s) => ({ poolLimits: { ...s.poolLimits, ...patch } })),
  setShowCumulative: (showCumulative) => set({ showCumulative }),
  setModelView: (modelView) => set({ modelView }),
  setStructureView: (structureView) => set({ structureView }),
  setHourlyView: (hourlyView) => set({ hourlyView }),
  setHourlyGranularity: (hourlyGranularity) => set({ hourlyGranularity }),
  setProjectionOpen: (projectionOpen) => set({ projectionOpen }),
}))
