import { formatInTimeZone } from 'date-fns-tz'
import Papa from 'papaparse'
import type { EventCosts, ReportMeta, TokenCounts, UsageEvent } from './types'
import { DEFAULT_POOL_LIMITS } from './types'
import {
  BILLABLE_KIND,
  FREE_KIND,
  ON_DEMAND_KIND,
  isBillableKind,
  isFreeKind,
  isOnDemandKind,
  normalizeKind,
  parseMaxMode,
  parseOfficialRowCost,
  resolveRowCost,
  resolveModelPricing,
} from './pricing'

function parseIntSafe(value: string | undefined | null): number {
  if (!value) return 0
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

function localDateHour(
  timestamp: string,
  timezone: string,
): { localDate: string; localHour: number; localMinuteOfDay: number } {
  if (!timestamp) return { localDate: '', localHour: 0, localMinuteOfDay: 0 }
  try {
    const localDate = formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd')
    const localHour = parseInt(formatInTimeZone(timestamp, timezone, 'H'), 10)
    const localMinute = parseInt(formatInTimeZone(timestamp, timezone, 'm'), 10)
    const hour = Number.isFinite(localHour) ? localHour : 0
    const minute = Number.isFinite(localMinute) ? localMinute : 0
    return { localDate, localHour: hour, localMinuteOfDay: hour * 60 + minute }
  } catch {
    return { localDate: timestamp.slice(0, 10), localHour: 0, localMinuteOfDay: 0 }
  }
}

export function parseCsvRows(
  rows: Record<string, string>[],
  timezone = 'UTC',
): {
  events: UsageEvent[]
  skippedRows: Record<string, number>
  unknownModels: Record<string, number>
  inferredModels: Record<string, { count: number; billingModel: string }>
} {
  const events: UsageEvent[] = []
  const skippedRows: Record<string, number> = {}
  const unknownModels: Record<string, number> = {}
  const inferredModels: Record<string, { count: number; billingModel: string }> = {}

  const bump = (map: Record<string, number>, key: string) => {
    map[key] = (map[key] ?? 0) + 1
  }

  const bumpInferredModel = (model: string, billingModel: string) => {
    const key = model || '(empty)'
    const current = inferredModels[key]
    inferredModels[key] = {
      count: (current?.count ?? 0) + 1,
      billingModel,
    }
  }

  rows.forEach((row, idx) => {
    const rawModel = row.Model ?? ''
    const kind = normalizeKind(row.Kind ?? '')
    const timestamp = row.Date ?? ''
    const { localDate, localHour, localMinuteOfDay } = localDateHour(timestamp, timezone)

    const tokens: TokenCounts = {
      icw: parseIntSafe(row['Input (w/ Cache Write)']),
      icwo: parseIntSafe(row['Input (w/o Cache Write)']),
      cacheRead: parseIntSafe(row['Cache Read']),
      output: parseIntSafe(row['Output Tokens']),
      total: parseIntSafe(row['Total Tokens']),
    }
    const maxMode = parseMaxMode(row['Max Mode'])
    const annotated = parseOfficialRowCost(row.Cost)
    const resolvedModel = resolveModelPricing(rawModel)
    const model = resolvedModel?.billingModel ?? rawModel
    const pool = resolvedModel?.pricing.pool ?? 'unknown'

    let included = 0
    let free = 0
    let onDemand = 0
    let eventKind = kind
    let skipReason: string | null = null

    if (isOnDemandKind(kind) && resolvedModel) {
      eventKind = ON_DEMAND_KIND
      onDemand = resolveRowCost(row.Cost, model, tokens.icw, tokens.icwo, tokens.cacheRead, tokens.output, maxMode)
      if (resolvedModel.inferred) bumpInferredModel(rawModel, resolvedModel.billingModel)
    } else if (isFreeKind(kind) && resolvedModel) {
      eventKind = FREE_KIND
      const officialFree = parseOfficialRowCost(row.Cost)
      free = resolveRowCost(row.Cost, model, tokens.icw, tokens.icwo, tokens.cacheRead, tokens.output, maxMode)
      if (officialFree !== null) included = officialFree
      if (resolvedModel.inferred) bumpInferredModel(rawModel, resolvedModel.billingModel)
    } else if (!isBillableKind(kind)) {
      eventKind = 'Skipped'
      skipReason = kind || '(empty)'
      bump(skippedRows, skipReason)
    } else if (!resolvedModel) {
      eventKind = 'Skipped'
      skipReason = 'unknown_model'
      bump(unknownModels, rawModel || '(empty)')
    } else {
      eventKind = BILLABLE_KIND
      included = resolveRowCost(row.Cost, model, tokens.icw, tokens.icwo, tokens.cacheRead, tokens.output, maxMode)
      if (resolvedModel.inferred) bumpInferredModel(rawModel, resolvedModel.billingModel)
    }

    const costs: EventCosts = { included, free, onDemand, annotated }

    events.push({
      id: String(idx),
      timestamp,
      localDate,
      localHour,
      localMinuteOfDay,
      rawModel,
      model,
      pool,
      kind: eventKind,
      skipReason,
      maxMode,
      tokens,
      costs,
      cloudAgentId: row['Cloud Agent ID'] || null,
      automationId: row['Automation ID'] || null,
    })
  })

  return { events, skippedRows, unknownModels, inferredModels }
}

export function parseCsvText(content: string, fileName: string, timezone = 'UTC'): { events: UsageEvent[]; meta: ReportMeta } {
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  const { events, skippedRows, unknownModels, inferredModels } = parseCsvRows(parsed.data, timezone)
  const dates = events.map((e) => e.localDate).filter(Boolean).sort()

  return {
    events,
    meta: {
      fileName,
      rowCount: parsed.data.length,
      dateFrom: dates[0] ?? null,
      dateTo: dates[dates.length - 1] ?? null,
      dataMaxDate: dates[dates.length - 1] ?? null,
      unknownModels,
      inferredModels,
      skippedRows,
      pricingCaveats: [],
      poolLimits: { ...DEFAULT_POOL_LIMITS },
    },
  }
}

export function parseCsvFile(file: File, timezone = 'UTC'): Promise<{ events: UsageEvent[]; meta: ReportMeta }> {
  return file.text().then((content) => parseCsvText(content, file.name, timezone))
}
