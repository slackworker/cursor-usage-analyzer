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

/** 日内时段分布：30m / 15m / 5m */
export type DailyActivityGranularity = 30 | 15 | 5

/** 周内时段分布：1h / 30m / 15m */
export type WeeklyActivityGranularity = 60 | 30 | 15

/** 聚合层通用时间槽粒度（两图并集） */
export type SlotGranularityMinutes = DailyActivityGranularity | WeeklyActivityGranularity

export const DAILY_ACTIVITY_GRANULARITY_OPTIONS: {
  value: DailyActivityGranularity
  label: string
}[] = [
  { value: 30, label: '30m' },
  { value: 15, label: '15m' },
  { value: 5, label: '5m' },
]

export const WEEKLY_ACTIVITY_GRANULARITY_OPTIONS: {
  value: WeeklyActivityGranularity
  label: string
}[] = [
  { value: 60, label: '1h' },
  { value: 30, label: '30m' },
  { value: 15, label: '15m' },
]

export const DEFAULT_DAILY_ACTIVITY_GRANULARITY: DailyActivityGranularity = 15
export const DEFAULT_WEEKLY_ACTIVITY_GRANULARITY: WeeklyActivityGranularity = 30

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
  /** 0–1439，本地时区当日分钟偏移 */
  localMinuteOfDay: number
  /** CSV 原始模型名 */
  rawModel: string
  /** 标准化后的模型名，聚合与计费默认基于该字段 */
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
}

export interface ReportMeta {
  fileName: string
  rowCount: number
  dateFrom: string | null
  dateTo: string | null
  dataMaxDate: string | null
  unknownModels: Record<string, number>
  inferredModels: Record<string, { count: number; billingModel: string }>
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

/** 归一化推算时折算的天数（跨账单月后按日均 Included 映射到 30 天） */
export const BILLING_CYCLE_DAYS = 30

export type PlanId = 'pro'

export const PLAN_PRESETS: Record<PlanId, { label: string; autoComposer: number; api: number }> = {
  pro: { label: 'Pro', ...DEFAULT_POOL_LIMITS },
}

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
