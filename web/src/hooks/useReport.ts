import { useMemo } from 'react'
import {
  cacheHitRateByModel,
  filterEvents,
  peakDailyCost,
  projectUsagePercent,
  resolveDateBounds,
  rollupBillingTotals,
  rollupByModel,
  rollupByPool,
  rollupDaily,
  rollupDailyCumulative,
  rollupHourly,
  rollupTokenStructure,
  rollupWeeklyHourly,
  rollupYearHeatmap,
  spanDays,
  unitPriceByModel,
} from '../lib/aggregation'
import { useReportStore } from '../store/reportStore'

export function useReport() {
  const fileName = useReportStore((s) => s.fileName)
  const events = useReportStore((s) => s.events)
  const meta = useReportStore((s) => s.meta)
  const filters = useReportStore((s) => s.filters)
  const poolLimits = useReportStore((s) => s.poolLimits)
  const modelView = useReportStore((s) => s.modelView)
  const structureView = useReportStore((s) => s.structureView)
  const dailyView = useReportStore((s) => s.dailyView)
  const hourlyView = useReportStore((s) => s.hourlyView)
  const dailyActivityGranularity = useReportStore((s) => s.dailyActivityGranularity)
  const weeklyActivityGranularity = useReportStore((s) => s.weeklyActivityGranularity)
  const projectionOpen = useReportStore((s) => s.projectionOpen)
  const setCsvFile = useReportStore((s) => s.setCsvFile)
  const clear = useReportStore((s) => s.clear)
  const setFilters = useReportStore((s) => s.setFilters)
  const setPoolLimits = useReportStore((s) => s.setPoolLimits)
  const setModelView = useReportStore((s) => s.setModelView)
  const setStructureView = useReportStore((s) => s.setStructureView)
  const setDailyView = useReportStore((s) => s.setDailyView)
  const setHourlyView = useReportStore((s) => s.setHourlyView)
  const setDailyActivityGranularity = useReportStore((s) => s.setDailyActivityGranularity)
  const setWeeklyActivityGranularity = useReportStore((s) => s.setWeeklyActivityGranularity)
  const setProjectionOpen = useReportStore((s) => s.setProjectionOpen)

  const filtered = useMemo(() => filterEvents(events, filters), [events, filters])
  const mode = filters.billingMode

  const agg = useMemo(() => {
    const billing = rollupBillingTotals(filtered, mode)
    const byModel = rollupByModel(filtered, modelView, mode)
    const byPool = rollupByPool(filtered, mode)
    const dateBounds = resolveDateBounds(events, filters.dateRange)
    const daily = rollupDaily(filtered, dailyView, 'all', mode, dateBounds)
    const dailyCumulative = rollupDailyCumulative(filtered, dailyView, 'all', mode, dateBounds)
    const structure = rollupTokenStructure(filtered, structureView, mode)
    const cacheHit = cacheHitRateByModel(filtered)
    const unitPrice = unitPriceByModel(filtered, mode)
    const hourly = rollupHourly(filtered, hourlyView, dailyActivityGranularity)
    const weekly = rollupWeeklyHourly(filtered, weeklyActivityGranularity)
    const heatmap = rollupYearHeatmap(filtered, 'sessions')
    const projection = projectUsagePercent(filtered, poolLimits, 'official')
    const days = spanDays(filtered)
    const peak = peakDailyCost(filtered, mode)
    const totalTokens = filtered.reduce((s, e) => (e.skipReason ? s : s + e.tokens.total), 0)

    return {
      billing,
      byModel,
      byPool,
      daily,
      dailyCumulative,
      structure,
      cacheHit,
      unitPrice,
      hourly,
      weekly,
      heatmap,
      projection,
      days,
      peak,
      totalTokens,
    }
  }, [events, filtered, mode, modelView, structureView, dailyView, hourlyView, dailyActivityGranularity, weeklyActivityGranularity, poolLimits, filters.dateRange])

  const allModels = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) {
      if (e.model && !e.skipReason) set.add(e.model)
    }
    return [...set].sort()
  }, [events])

  const heatmapVisible = agg.days >= 90

  return {
    fileName,
    meta,
    rowCount: meta?.rowCount ?? 0,
    hasData: events.length > 0,
    events,
    filtered,
    filters,
    poolLimits,
    modelView,
    structureView,
    dailyView,
    hourlyView,
    dailyActivityGranularity,
    weeklyActivityGranularity,
    projectionOpen,
    allModels,
    heatmapVisible,
    agg,
    setCsvFile,
    clear,
    setFilters,
    setPoolLimits,
    setModelView,
    setStructureView,
    setDailyView,
    setHourlyView,
    setDailyActivityGranularity,
    setWeeklyActivityGranularity,
    setProjectionOpen,
  }
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function formatTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}
