import { create } from 'zustand'
import type { FilterState, ReportMeta, UsageEvent } from '../lib/types'
import { DEFAULT_POOL_LIMITS } from '../lib/types'
import { parseCsvText } from '../lib/parser'

const defaultTimezone =
  typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC'

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
  projectionOpen: boolean
  setCsvFile: (file: File) => Promise<void>
  clear: () => void
  setFilters: (patch: Partial<FilterState>) => void
  setPoolLimits: (patch: Partial<{ autoComposer: number; api: number }>) => void
  setShowCumulative: (v: boolean) => void
  setModelView: (v: 'cost' | 'token') => void
  setStructureView: (v: 'cost' | 'token') => void
  setHourlyView: (v: 'sessions' | 'tokens') => void
  setProjectionOpen: (v: boolean) => void
}

const defaultFilters: FilterState = {
  dateRange: 'all',
  billingMode: 'standard',
  models: 'all',
  timezone: defaultTimezone,
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
  projectionOpen: false,

  setCsvFile: async (file: File) => {
    const content = await file.text()
    const tz = useReportStore.getState().filters.timezone
    const { events, meta } = parseCsvText(content, file.name, tz)
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
      filters: { ...defaultFilters, timezone: defaultTimezone },
      poolLimits: { ...DEFAULT_POOL_LIMITS },
      showCumulative: false,
      modelView: 'cost',
      structureView: 'token',
      hourlyView: 'sessions',
      projectionOpen: false,
    }),

  setFilters: (patch) => {
    set((s) => {
      const filters = { ...s.filters, ...patch }
      if (patch.timezone && s.fileContent && s.fileName) {
        const { events, meta } = parseCsvText(s.fileContent, s.fileName, filters.timezone)
        return { filters, events, meta }
      }
      return { filters }
    })
  },

  setPoolLimits: (patch) => set((s) => ({ poolLimits: { ...s.poolLimits, ...patch } })),
  setShowCumulative: (showCumulative) => set({ showCumulative }),
  setModelView: (modelView) => set({ modelView }),
  setStructureView: (structureView) => set({ structureView }),
  setHourlyView: (hourlyView) => set({ hourlyView }),
  setProjectionOpen: (projectionOpen) => set({ projectionOpen }),
}))
