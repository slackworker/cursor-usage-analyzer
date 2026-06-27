import { formatInTimeZone } from 'date-fns-tz'
import Papa from 'papaparse'
import type { EventCosts, ReportMeta, TokenCounts, UsageEvent } from './types'
import { DEFAULT_POOL_LIMITS } from './types'
import {
  BILLABLE_KIND,
  FREE_KIND,
  ON_DEMAND_KIND,
  PRICING,
  isBillableKind,
  isFreeKind,
  isOnDemandKind,
  normalizeKind,
  parseMaxMode,
  parseOfficialRowCost,
  resolveRowCost,
} from './pricing'

function parseIntSafe(value: string | undefined | null): number {
  if (!value) return 0
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

function localDateHour(timestamp: string, timezone: string): { localDate: string; localHour: number } {
  if (!timestamp) return { localDate: '', localHour: 0 }
  try {
    const localDate = formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd')
    const localHour = parseInt(formatInTimeZone(timestamp, timezone, 'H'), 10)
    return { localDate, localHour: Number.isFinite(localHour) ? localHour : 0 }
  } catch {
    return { localDate: timestamp.slice(0, 10), localHour: 0 }
  }
}

export function parseCsvRows(
  rows: Record<string, string>[],
  timezone = 'UTC',
): { events: UsageEvent[]; skippedRows: Record<string, number>; unknownModels: Record<string, number> } {
  const events: UsageEvent[] = []
  const skippedRows: Record<string, number> = {}
  const unknownModels: Record<string, number> = {}

  const bump = (map: Record<string, number>, key: string) => {
    map[key] = (map[key] ?? 0) + 1
  }

  rows.forEach((row, idx) => {
    const model = row.Model ?? ''
    const kind = normalizeKind(row.Kind ?? '')
    const timestamp = row.Date ?? ''
    const { localDate, localHour } = localDateHour(timestamp, timezone)

    const tokens: TokenCounts = {
      icw: parseIntSafe(row['Input (w/ Cache Write)']),
      icwo: parseIntSafe(row['Input (w/o Cache Write)']),
      cacheRead: parseIntSafe(row['Cache Read']),
      output: parseIntSafe(row['Output Tokens']),
      total: parseIntSafe(row['Total Tokens']),
    }
    const maxMode = parseMaxMode(row['Max Mode'])
    const annotated = parseOfficialRowCost(row.Cost)
    const pool = PRICING[model]?.pool ?? 'unknown'

    let included = 0
    let free = 0
    let onDemand = 0
    let eventKind = kind
    let skipReason: string | null = null

    if (isOnDemandKind(kind) && model in PRICING) {
      eventKind = ON_DEMAND_KIND
      onDemand = resolveRowCost(row.Cost, model, tokens.icw, tokens.icwo, tokens.cacheRead, tokens.output, maxMode)
    } else if (isFreeKind(kind) && model in PRICING) {
      eventKind = FREE_KIND
      const officialFree = parseOfficialRowCost(row.Cost)
      free = resolveRowCost(row.Cost, model, tokens.icw, tokens.icwo, tokens.cacheRead, tokens.output, maxMode)
      if (officialFree !== null) included = officialFree
    } else if (!isBillableKind(kind)) {
      eventKind = 'Skipped'
      skipReason = kind || '(empty)'
      bump(skippedRows, skipReason)
    } else if (!(model in PRICING)) {
      eventKind = 'Skipped'
      skipReason = 'unknown_model'
      bump(unknownModels, model || '(empty)')
    } else {
      eventKind = BILLABLE_KIND
      included = resolveRowCost(row.Cost, model, tokens.icw, tokens.icwo, tokens.cacheRead, tokens.output, maxMode)
    }

    const costs: EventCosts = { included, free, onDemand, annotated }

    events.push({
      id: String(idx),
      timestamp,
      localDate,
      localHour,
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

  return { events, skippedRows, unknownModels }
}

export function parseCsvText(content: string, fileName: string, timezone = 'UTC'): { events: UsageEvent[]; meta: ReportMeta } {
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  const { events, skippedRows, unknownModels } = parseCsvRows(parsed.data, timezone)
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
      skippedRows,
      pricingCaveats: [],
      poolLimits: { ...DEFAULT_POOL_LIMITS },
    },
  }
}

export function parseCsvFile(file: File, timezone = 'UTC'): Promise<{ events: UsageEvent[]; meta: ReportMeta }> {
  return file.text().then((content) => parseCsvText(content, file.name, timezone))
}
