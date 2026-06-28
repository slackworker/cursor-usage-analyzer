import { useMemo } from 'react'
import {
  cacheHitRateByModel,
  filterEvents,
  peakDailyCost,
  projectUsagePercent,
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
  const showCumulative = useReportStore((s) => s.showCumulative)
  const modelView = useReportStore((s) => s.modelView)
  const structureView = useReportStore((s) => s.structureView)
  const hourlyView = useReportStore((s) => s.hourlyView)
  const hourlyGranularity = useReportStore((s) => s.hourlyGranularity)
  const projectionOpen = useReportStore((s) => s.projectionOpen)
  const setCsvFile = useReportStore((s) => s.setCsvFile)
  const clear = useReportStore((s) => s.clear)
  const setFilters = useReportStore((s) => s.setFilters)
  const setPoolLimits = useReportStore((s) => s.setPoolLimits)
  const setShowCumulative = useReportStore((s) => s.setShowCumulative)
  const setModelView = useReportStore((s) => s.setModelView)
  const setStructureView = useReportStore((s) => s.setStructureView)
  const setHourlyView = useReportStore((s) => s.setHourlyView)
  const setHourlyGranularity = useReportStore((s) => s.setHourlyGranularity)
  const setProjectionOpen = useReportStore((s) => s.setProjectionOpen)

  const filtered = useMemo(() => filterEvents(events, filters), [events, filters])
  const mode = filters.billingMode

  const agg = useMemo(() => {
    const billing = rollupBillingTotals(filtered, mode)
    const byModel = rollupByModel(filtered, modelView, mode)
    const byPool = rollupByPool(filtered, mode)
    const daily = rollupDaily(filtered, 'cost', 'all', mode)
    const dailyCumulative = rollupDailyCumulative(filtered, 'cost', 'all', mode)
    const structure = rollupTokenStructure(filtered, structureView, mode)
    const cacheHit = cacheHitRateByModel(filtered)
    const unitPrice = unitPriceByModel(filtered, mode)
    const hourly = rollupHourly(filtered, hourlyView, hourlyGranularity)
    const weekly = rollupWeeklyHourly(filtered)
    const heatmap = rollupYearHeatmap(filtered, 'cost', mode)
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
  }, [filtered, mode, modelView, structureView, hourlyView, hourlyGranularity, poolLimits])

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
    showCumulative,
    modelView,
    structureView,
    hourlyView,
    hourlyGranularity,
    projectionOpen,
    allModels,
    heatmapVisible,
    agg,
    setCsvFile,
    clear,
    setFilters,
    setPoolLimits,
    setShowCumulative,
    setModelView,
    setStructureView,
    setHourlyView,
    setHourlyGranularity,
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
