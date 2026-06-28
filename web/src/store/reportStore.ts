import { create } from 'zustand'
import type {
  DailyActivityGranularity,
  FilterState,
  PlanId,
  ReportMeta,
  UsageEvent,
  WeeklyActivityGranularity,
} from '../lib/types'
import {
  DEFAULT_DAILY_ACTIVITY_GRANULARITY,
  DEFAULT_WEEKLY_ACTIVITY_GRANULARITY,
  DEFAULT_POOL_LIMITS,
  PLAN_PRESETS,
} from '../lib/types'
import { parseCsvText } from '../lib/parser'
import { getUserTimezone } from '../lib/timezone'

export interface ReportStore {
  fileName: string | null
  fileContent: string | null
  events: UsageEvent[]
  meta: ReportMeta | null
  filters: FilterState
  poolLimits: { autoComposer: number; api: number }
  plan: PlanId
  modelView: 'cost' | 'token'
  structureView: 'cost' | 'token'
  dailyView: 'cost' | 'token'
  dailyChartLayout: 'bar' | 'stack'
  hourlyView: 'sessions' | 'tokens'
  dailyActivityGranularity: DailyActivityGranularity
  weeklyActivityGranularity: WeeklyActivityGranularity
  setCsvFile: (file: File) => Promise<void>
  clear: () => void
  setFilters: (patch: Partial<FilterState>) => void
  setPoolLimits: (patch: Partial<{ autoComposer: number; api: number }>) => void
  setPlan: (plan: PlanId) => void
  setModelView: (v: 'cost' | 'token') => void
  setStructureView: (v: 'cost' | 'token') => void
  setDailyView: (v: 'cost' | 'token') => void
  setDailyChartLayout: (v: 'bar' | 'stack') => void
  setHourlyView: (v: 'sessions' | 'tokens') => void
  setDailyActivityGranularity: (v: DailyActivityGranularity) => void
  setWeeklyActivityGranularity: (v: WeeklyActivityGranularity) => void
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
  plan: 'pro',
  modelView: 'cost',
  structureView: 'token',
  dailyView: 'token',
  dailyChartLayout: 'bar',
  hourlyView: 'sessions',
  dailyActivityGranularity: DEFAULT_DAILY_ACTIVITY_GRANULARITY,
  weeklyActivityGranularity: DEFAULT_WEEKLY_ACTIVITY_GRANULARITY,
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
      plan: 'pro',
      modelView: 'cost',
      structureView: 'token',
      dailyView: 'token',
      dailyChartLayout: 'bar',
      hourlyView: 'sessions',
      dailyActivityGranularity: DEFAULT_DAILY_ACTIVITY_GRANULARITY,
      weeklyActivityGranularity: DEFAULT_WEEKLY_ACTIVITY_GRANULARITY,
    }),

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

  setPoolLimits: (patch) => set((s) => ({ poolLimits: { ...s.poolLimits, ...patch } })),
  setPlan: (plan) => {
    const preset = PLAN_PRESETS[plan]
    set({ plan, poolLimits: { autoComposer: preset.autoComposer, api: preset.api } })
  },
  setModelView: (modelView) => set({ modelView }),
  setStructureView: (structureView) => set({ structureView }),
  setDailyView: (dailyView) => set({ dailyView }),
  setDailyChartLayout: (dailyChartLayout) => set({ dailyChartLayout }),
  setHourlyView: (hourlyView) => set({ hourlyView }),
  setDailyActivityGranularity: (dailyActivityGranularity) => set({ dailyActivityGranularity }),
  setWeeklyActivityGranularity: (weeklyActivityGranularity) => set({ weeklyActivityGranularity }),
}))
