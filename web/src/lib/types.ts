export type PoolKind = 'auto_composer' | 'api'
export type BillingMode = 'official' | 'standard'
export type DateRangePreset =
  | 'all'
  | '1d'
  | '7d'
  | '30d'
  | 'mtd'
  | 'last_month'
  | 'custom'

export interface TokenCounts {
  icw: number
  icwo: number
  cacheRead: number
  output: number
  total: number
}

export interface EventCosts {
  included: number
  free: number
  onDemand: number
  annotated?: number | null
}

export interface UsageEvent {
  id: string
  timestamp: string
  localDate: string
  localHour: number
  model: string
  pool: PoolKind | string
  kind: string
  skipReason?: string | null
  maxMode: boolean
  tokens: TokenCounts
  costs: EventCosts
  cloudAgentId?: string | null
  automationId?: string | null
}

export interface FilterState {
  dateRange: DateRangePreset | { from: string; to: string }
  billingMode: BillingMode
  models: string[] | 'all'
  timezone: string
}

export interface ReportMeta {
  fileName: string
  rowCount: number
  dateFrom: string | null
  dateTo: string | null
  dataMaxDate: string | null
  unknownModels: Record<string, number>
  skippedRows: Record<string, number>
  pricingCaveats: string[]
  poolLimits: { autoComposer: number; api: number }
}

export interface BillingTotals {
  total: number
  included: number
  free: number
  onDemand: number
}

export const DEFAULT_POOL_LIMITS = { autoComposer: 145, api: 45 }

export const POOL_LABELS: Record<string, string> = {
  auto_composer: 'Auto + Composer',
  api: 'API',
}

export const MODEL_COLORS = [
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#a371f7',
  '#39c5cf',
  '#db6d28',
  '#8b949e',
]
