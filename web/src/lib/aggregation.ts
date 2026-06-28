import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, subDays, subMonths } from 'date-fns'
import type {
  BillingMode,
  BillingTotals,
  DailyActivityGranularity,
  FilterState,
  SlotGranularityMinutes,
  UsageEvent,
  WeeklyActivityGranularity,
} from './types'
import { DEFAULT_DAILY_ACTIVITY_GRANULARITY, DEFAULT_WEEKLY_ACTIVITY_GRANULARITY } from './types'
import {
  FREE_STATUS_ONLY_SKIP,
  isBillableKind,
  isFreeKind,
  isOnDemandKind,
  rowCostBreakdown,
} from './pricing'

function eventCost(event: UsageEvent, mode: BillingMode): number {
  if (isOnDemandKind(event.kind)) return event.costs.onDemand
  if (isFreeKind(event.kind)) return mode === 'standard' ? event.costs.free : 0
  if (isBillableKind(event.kind)) return event.costs.included
  return 0
}

function dataMaxDate(events: UsageEvent[]): string | null {
  const dates = events.map((e) => e.localDate).filter(Boolean)
  return dates.length ? dates.sort().at(-1)! : null
}

function resolveDateBounds(
  events: UsageEvent[],
  dateRange: FilterState['dateRange'],
): { from: string | null; to: string | null } {
  const max = dataMaxDate(events)
  if (!max) return { from: null, to: null }

  if (typeof dateRange === 'object') {
    return { from: dateRange.from, to: dateRange.to }
  }

  const maxDt = parseISO(max)

  switch (dateRange) {
    case 'all': {
      const dates = events.map((e) => e.localDate).filter(Boolean).sort()
      return { from: dates[0] ?? null, to: dates.at(-1) ?? null }
    }
    case '1d':
      return { from: max, to: max }
    case '7d':
      return { from: format(subDays(maxDt, 6), 'yyyy-MM-dd'), to: max }
    case '30d':
      return { from: format(subDays(maxDt, 29), 'yyyy-MM-dd'), to: max }
    case 'mtd':
      return { from: format(startOfMonth(maxDt), 'yyyy-MM-dd'), to: max }
    case 'last_month': {
      const prev = subMonths(maxDt, 1)
      const first = startOfMonth(prev)
      const last = addDays(startOfMonth(maxDt), -1)
      return { from: format(first, 'yyyy-MM-dd'), to: format(last, 'yyyy-MM-dd') }
    }
    default:
      return { from: null, to: null }
  }
}

export function filterEvents(events: UsageEvent[], filters: FilterState): UsageEvent[] {
  const { from, to } = resolveDateBounds(events, filters.dateRange)
  const modelSet = filters.models === 'all' ? null : new Set(filters.models)

  return events.filter((event) => {
    if (from && event.localDate && event.localDate < from) return false
    if (to && event.localDate && event.localDate > to) return false
    if (modelSet && !modelSet.has(event.model)) return false
    return true
  })
}

export function rollupBillingTotals(events: UsageEvent[], mode: BillingMode): BillingTotals {
  let included = 0
  let free = 0
  let onDemand = 0

  for (const event of events) {
    if (event.skipReason === 'unknown_model') continue
    if (isFreeKind(event.kind)) {
      if (mode === 'official') included += event.costs.included
      else free += event.costs.free
      continue
    }
    if (isOnDemandKind(event.kind)) {
      onDemand += event.costs.onDemand
      continue
    }
    if (isBillableKind(event.kind)) included += event.costs.included
  }

  const total = mode === 'official' ? included + onDemand : included + free + onDemand
  return { included, free, onDemand, total }
}

export function rollupByModel(
  events: UsageEvent[],
  view: 'cost' | 'token',
  mode: BillingMode = 'standard',
): Record<string, { cost: number; tokens: number }> {
  const totals: Record<string, { cost: number; tokens: number }> = {}

  for (const event of events) {
    if (event.skipReason || !event.model) continue
    if (isFreeKind(event.kind) && mode === 'official' && event.costs.annotated == null) continue

    if (!totals[event.model]) totals[event.model] = { cost: 0, tokens: 0 }
    totals[event.model].tokens += event.tokens.total

    if (view === 'token') continue

    if (isFreeKind(event.kind)) {
      totals[event.model].cost += mode === 'standard' ? event.costs.free : event.costs.included
    } else if (isOnDemandKind(event.kind)) {
      totals[event.model].cost += event.costs.onDemand
    } else if (isBillableKind(event.kind)) {
      totals[event.model].cost += event.costs.included
    }
  }

  return totals
}

export function rollupByPool(
  events: UsageEvent[],
  mode: BillingMode = 'official',
): Record<string, { included: number; free: number; onDemand: number; tokens: number; rows: number }> {
  const totals: Record<string, { included: number; free: number; onDemand: number; tokens: number; rows: number }> = {}

  for (const event of events) {
    if (!event.pool || event.skipReason) continue
    if (!totals[event.pool]) {
      totals[event.pool] = { included: 0, free: 0, onDemand: 0, tokens: 0, rows: 0 }
    }
    const b = totals[event.pool]
    b.rows += 1
    b.tokens += event.tokens.total

    if (isFreeKind(event.kind)) {
      if (mode === 'official') b.included += event.costs.included
      else b.free += event.costs.free
    } else if (isOnDemandKind(event.kind)) {
      b.onDemand += event.costs.onDemand
    } else if (isBillableKind(event.kind)) {
      b.included += event.costs.included
    }
  }

  return totals
}

export function rollupDaily(
  events: UsageEvent[],
  view: 'cost' | 'token',
  models: string[] | 'all' = 'all',
  mode: BillingMode = 'standard',
): { date: string; byModel: Record<string, number> }[] {
  const modelSet = models === 'all' ? null : new Set(models)
  const byDay: Record<string, Record<string, number>> = {}

  for (const event of events) {
    if (!event.localDate || event.skipReason) continue
    if (modelSet && !modelSet.has(event.model)) continue

    if (!byDay[event.localDate]) byDay[event.localDate] = {}

    if (view === 'token') {
      byDay[event.localDate][event.model] = (byDay[event.localDate][event.model] ?? 0) + event.tokens.total
      continue
    }

    let cost = 0
    if (isFreeKind(event.kind)) cost = mode === 'standard' ? event.costs.free : event.costs.included
    else if (isOnDemandKind(event.kind)) cost = event.costs.onDemand
    else if (isBillableKind(event.kind)) cost = event.costs.included

    byDay[event.localDate][event.model] = (byDay[event.localDate][event.model] ?? 0) + cost
  }

  return Object.keys(byDay)
    .sort()
    .map((date) => ({ date, byModel: byDay[date] }))
}

export function rollupDailyCumulative(
  events: UsageEvent[],
  view: 'cost' | 'token',
  models: string[] | 'all' = 'all',
  mode: BillingMode = 'standard',
): { date: string; daily: number; cumulative: number }[] {
  const daily = rollupDaily(events, view, models, mode)
  let cumulative = 0
  return daily.map(({ date, byModel }) => {
    const dayTotal = Object.values(byModel).reduce((a, b) => a + b, 0)
    cumulative += dayTotal
    return { date, daily: dayTotal, cumulative }
  })
}

function structureRowCharge(event: UsageEvent, mode: BillingMode): number {
  if (isOnDemandKind(event.kind)) return event.costs.onDemand
  if (isFreeKind(event.kind)) {
    if (mode === 'official') return event.costs.annotated != null ? event.costs.included : 0
    return event.costs.free
  }
  if (isBillableKind(event.kind)) return event.costs.included
  return 0
}

export function rollupTokenStructure(
  events: UsageEvent[],
  view: 'cost' | 'token' = 'token',
  mode: BillingMode = 'standard',
): {
  icw: number
  icwo: number
  cacheRead: number
  output: number
  total: number
} {
  const t = { icw: 0, icwo: 0, cacheRead: 0, output: 0, total: 0 }
  for (const event of events) {
    if (event.skipReason) continue

    if (view === 'token') {
      t.icw += event.tokens.icw
      t.icwo += event.tokens.icwo
      t.cacheRead += event.tokens.cacheRead
      t.output += event.tokens.output
      t.total += event.tokens.total
      continue
    }

    const rowCharge = structureRowCharge(event, mode)
    if (rowCharge <= 0) continue

    const breakdown = rowCostBreakdown(
      event.model,
      event.tokens.icw,
      event.tokens.icwo,
      event.tokens.cacheRead,
      event.tokens.output,
      event.maxMode,
    )
    const breakdownTotal =
      breakdown.icw + breakdown.icwo + breakdown.cacheRead + breakdown.output
    if (breakdownTotal <= 0) continue

    const scale = rowCharge / breakdownTotal
    t.icw += breakdown.icw * scale
    t.icwo += breakdown.icwo * scale
    t.cacheRead += breakdown.cacheRead * scale
    t.output += breakdown.output * scale
    t.total += rowCharge
  }
  return t
}

export function cacheHitRateByModel(events: UsageEvent[]): Record<string, number> {
  const numer: Record<string, number> = {}
  const denom: Record<string, number> = {}

  for (const event of events) {
    if (event.skipReason) continue
    const miss = event.tokens.icw + event.tokens.icwo
    const cr = event.tokens.cacheRead
    denom[event.model] = (denom[event.model] ?? 0) + miss + cr
    numer[event.model] = (numer[event.model] ?? 0) + cr
  }

  const result: Record<string, number> = {}
  for (const model of Object.keys(denom)) {
    result[model] = denom[model] ? numer[model] / denom[model] : 0
  }
  return result
}

export function unitPriceByModel(events: UsageEvent[], mode: BillingMode = 'standard'): Record<string, number> {
  const costs: Record<string, number> = {}
  const tokens: Record<string, number> = {}

  for (const event of events) {
    if (event.skipReason) continue
    tokens[event.model] = (tokens[event.model] ?? 0) + event.tokens.total
    if (isFreeKind(event.kind)) {
      costs[event.model] = (costs[event.model] ?? 0) + (mode === 'standard' ? event.costs.free : event.costs.included)
    } else if (isOnDemandKind(event.kind)) {
      costs[event.model] = (costs[event.model] ?? 0) + event.costs.onDemand
    } else if (isBillableKind(event.kind)) {
      costs[event.model] = (costs[event.model] ?? 0) + event.costs.included
    }
  }

  const result: Record<string, number> = {}
  for (const model of Object.keys(tokens)) {
    result[model] = tokens[model] ? (costs[model] / tokens[model]) * 1e6 : 0
  }
  return result
}

export const ACTIVITY_AXIS_START_HOUR = 3

export function activitySlotsPerDay(granularityMinutes: SlotGranularityMinutes): number {
  return 1440 / granularityMinutes
}

export function activityAxisOrder(granularityMinutes: SlotGranularityMinutes): number[] {
  const slots = activitySlotsPerDay(granularityMinutes)
  const start = (ACTIVITY_AXIS_START_HOUR * 60) / granularityMinutes
  return Array.from({ length: slots }, (_, i) => (start + i) % slots)
}

export function formatActivitySlotLabel(slot: number, granularityMinutes: SlotGranularityMinutes): string {
  const minutes = slot * granularityMinutes
  const hour = Math.floor(minutes / 60) % 24
  const minute = minutes % 60
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

export function activityLabelStep(granularityMinutes: SlotGranularityMinutes): number {
  return 60 / granularityMinutes
}

export function rollupHourly(
  events: UsageEvent[],
  view: 'sessions' | 'tokens' = 'sessions',
  granularityMinutes: DailyActivityGranularity = DEFAULT_DAILY_ACTIVITY_GRANULARITY,
): { slot: number; value: number }[] {
  const slotsPerDay = activitySlotsPerDay(granularityMinutes)
  const buckets = Array.from({ length: slotsPerDay }, (_, slot) => ({ slot, value: 0 }))
  for (const event of events) {
    if (event.skipReason) continue
    const slot = Math.floor(event.localMinuteOfDay / granularityMinutes)
    if (slot < 0 || slot >= slotsPerDay) continue
    buckets[slot].value += view === 'sessions' ? 1 : event.tokens.total
  }
  return buckets
}

export function rollupWeeklyHourly(
  events: UsageEvent[],
  granularityMinutes: WeeklyActivityGranularity = DEFAULT_WEEKLY_ACTIVITY_GRANULARITY,
): number[][] {
  const slotsPerDay = activitySlotsPerDay(granularityMinutes)
  const matrix = Array.from({ length: 7 }, () => Array(slotsPerDay).fill(0))
  for (const event of events) {
    if (event.skipReason || !event.localDate) continue
    try {
      const dow = parseISO(event.localDate).getDay()
      const isoDow = dow === 0 ? 6 : dow - 1
      const slot = Math.floor(event.localMinuteOfDay / granularityMinutes)
      if (slot >= 0 && slot < slotsPerDay) matrix[isoDow][slot] += 1
    } catch {
      /* skip invalid dates */
    }
  }
  return matrix
}

export function rollupYearHeatmap(
  events: UsageEvent[],
  metric: 'cost' | 'tokens' | 'sessions' = 'cost',
  mode: BillingMode = 'standard',
): { date: string; value: number }[] {
  const byDay: Record<string, number> = {}
  for (const event of events) {
    if (event.skipReason || !event.localDate) continue
    if (metric === 'sessions') byDay[event.localDate] = (byDay[event.localDate] ?? 0) + 1
    else if (metric === 'tokens') byDay[event.localDate] = (byDay[event.localDate] ?? 0) + event.tokens.total
    else byDay[event.localDate] = (byDay[event.localDate] ?? 0) + eventCost(event, mode)
  }
  return Object.keys(byDay)
    .sort()
    .map((date) => ({ date, value: byDay[date] }))
}

export function projectUsagePercent(
  events: UsageEvent[],
  limits: { autoComposer: number; api: number },
  mode: BillingMode = 'official',
): {
  spanDays: number
  dailyAvg: number
  projected30d: number
  autoComposerPct: number
  apiPct: number
  totalPct: number
} {
  const totals = rollupBillingTotals(events, mode)
  const dates = events.filter((e) => e.localDate && !e.skipReason).map((e) => e.localDate).sort()

  if (!dates.length) {
    return { spanDays: 0, dailyAvg: 0, projected30d: 0, autoComposerPct: 0, apiPct: 0, totalPct: 0 }
  }

  const spanDays = differenceInCalendarDays(parseISO(dates.at(-1)!), parseISO(dates[0])) + 1
  const dailyAvg = totals.included / spanDays
  const projected30d = dailyAvg * 30

  const pools = rollupByPool(events, mode)
  const acDaily = (pools.auto_composer?.included ?? 0) / spanDays
  const apiDaily = (pools.api?.included ?? 0) / spanDays
  const totalLimit = limits.autoComposer + limits.api

  return {
    spanDays,
    dailyAvg,
    projected30d,
    autoComposerPct: limits.autoComposer ? (acDaily * 30 / limits.autoComposer) * 100 : 0,
    apiPct: limits.api ? (apiDaily * 30 / limits.api) * 100 : 0,
    totalPct: totalLimit ? (projected30d / totalLimit) * 100 : 0,
  }
}

export function buildUsageSummary(
  events: UsageEvent[],
  mode: BillingMode,
): {
  totalCost: number
  totalTokens: number
  freeCost: number
  billableRows: number
  skippedRows: Record<string, number>
} {
  let totalCost = 0
  let freeCost = 0
  let totalTokens = 0
  let billableRows = 0
  const skippedRows: Record<string, number> = {}
  let statusOnly = 0

  for (const event of events) {
    if (event.skipReason === 'unknown_model') continue
    if (event.skipReason) continue

    if (isFreeKind(event.kind)) {
      if (mode === 'official') {
        if (event.costs.annotated != null) {
          totalCost += event.costs.included
          totalTokens += event.tokens.total
          billableRows += 1
        } else {
          statusOnly += 1
        }
      } else {
        freeCost += event.costs.free
        totalTokens += event.tokens.total
      }
      continue
    }

    if (isOnDemandKind(event.kind) || isBillableKind(event.kind)) {
      const cost = isOnDemandKind(event.kind) ? event.costs.onDemand : event.costs.included
      totalCost += cost
      totalTokens += event.tokens.total
      billableRows += 1
    }
  }

  if (statusOnly) skippedRows[FREE_STATUS_ONLY_SKIP] = statusOnly

  const totalSpend = mode === 'official' ? totalCost : totalCost + freeCost
  return { totalCost: totalSpend, totalTokens, freeCost, billableRows, skippedRows }
}

export function spanDays(events: UsageEvent[]): number {
  const dates = events.filter((e) => e.localDate && !e.skipReason).map((e) => e.localDate).sort()
  if (dates.length < 2) return dates.length
  return differenceInCalendarDays(parseISO(dates.at(-1)!), parseISO(dates[0])) + 1
}

export function peakDailyCost(
  events: UsageEvent[],
  mode: BillingMode,
): { date: string; value: number; topModel: string | null } | null {
  const daily = rollupDaily(events, 'cost', 'all', mode)
  if (!daily.length) return null
  let best = daily[0]
  for (const row of daily) {
    const v = Object.values(row.byModel).reduce((a, b) => a + b, 0)
    const bestV = Object.values(best.byModel).reduce((a, b) => a + b, 0)
    if (v > bestV) best = row
  }
  const value = Object.values(best.byModel).reduce((a, b) => a + b, 0)
  let topModel: string | null = null
  let topCost = -Infinity
  for (const [model, cost] of Object.entries(best.byModel)) {
    if (cost > topCost) {
      topCost = cost
      topModel = model
    }
  }
  return {
    date: best.date,
    value,
    topModel,
  }
}
export { FREE_STATUS_ONLY_SKIP }
