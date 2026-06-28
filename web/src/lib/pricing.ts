export interface ModelPricing {
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
  pool: string
}

export const BILLABLE_KIND = 'Included'
export const FREE_KIND = 'Free'
export const FREE_STATUS_ONLY_SKIP = 'Free (status-only)'
export const ON_DEMAND_KIND = 'On-demand'

const KIND_ALIASES: Record<string, string> = {
  included: BILLABLE_KIND,
  free: FREE_KIND,
  'on-demand': ON_DEMAND_KIND,
  ondemand: ON_DEMAND_KIND,
  'errored, no charge': 'Errored, No Charge',
  'aborted, not charged': 'Aborted, Not Charged',
}

export function normalizeKind(kind: string): string {
  const key = (kind ?? '').trim().toLowerCase()
  return KIND_ALIASES[key] ?? (kind ?? '').trim()
}

export function isBillableKind(kind: string): boolean {
  return normalizeKind(kind) === BILLABLE_KIND
}

export function isFreeKind(kind: string): boolean {
  return normalizeKind(kind) === FREE_KIND
}

export function isOnDemandKind(kind: string): boolean {
  return normalizeKind(kind) === ON_DEMAND_KIND
}

export const LONG_CONTEXT_INPUT_THRESHOLD = 272_000
export const CODEX_MAX_MODE_FAST_MODELS = new Set(['gpt-5.3-codex', 'gpt-5.3-codex-high'])
export const GPT_LONG_CONTEXT_MODELS = new Set(['gpt-5.4-medium', 'gpt-5.5-medium'])
export const CODEX_MAX_MODE_MULTIPLIER = 2.0
export const LONG_CONTEXT_INPUT_MULTIPLIER = 2.0
export const LONG_CONTEXT_OUTPUT_MULTIPLIER = 1.5
export const AGENT_REVIEW_DISCOUNT_RATIO = 1.0

export function parseMaxMode(value: string | undefined | null): boolean {
  return (value ?? '').trim().toLowerCase() === 'yes'
}

export function tokenRowCost(
  pricing: ModelPricing,
  icw: number,
  icwo: number,
  cr: number,
  out: number,
  opts: {
    inputMult?: number
    cacheWriteMult?: number
    cacheReadMult?: number
    outputMult?: number
  } = {},
): number {
  const inputMult = opts.inputMult ?? 1
  const cwm = opts.cacheWriteMult ?? inputMult
  const crm = opts.cacheReadMult ?? inputMult
  const outputMult = opts.outputMult ?? 1
  return (
    (icw / 1e6) * pricing.cacheWrite * cwm +
    (icwo / 1e6) * pricing.input * inputMult +
    (cr / 1e6) * pricing.cacheRead * crm +
    (out / 1e6) * pricing.output * outputMult
  )
}

export function maxModeAdjustedCost(
  model: string,
  pricing: ModelPricing,
  icw: number,
  icwo: number,
  cr: number,
  out: number,
  maxMode: boolean,
): number | null {
  if (!maxMode) return null

  if (CODEX_MAX_MODE_FAST_MODELS.has(model)) {
    const m = CODEX_MAX_MODE_MULTIPLIER
    return tokenRowCost(pricing, icw, icwo, cr, out, { inputMult: m, outputMult: m })
  }

  if (GPT_LONG_CONTEXT_MODELS.has(model)) {
    if (icw + icwo + cr <= LONG_CONTEXT_INPUT_THRESHOLD) return null
    return tokenRowCost(pricing, icw, icwo, cr, out, {
      inputMult: LONG_CONTEXT_INPUT_MULTIPLIER,
      cacheReadMult: LONG_CONTEXT_INPUT_MULTIPLIER,
      outputMult: LONG_CONTEXT_OUTPUT_MULTIPLIER,
    })
  }

  return null
}

export function parseOfficialRowCost(value: string | undefined | null): number | null {
  if (!value) return null
  const text = value.trim()
  if (!text || text === BILLABLE_KIND || text === FREE_KIND || text === '-') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

export const PRICING: Record<string, ModelPricing> = {
  auto: { input: 1.25, cacheWrite: 1.25, cacheRead: 0.25, output: 6.0, pool: 'auto_composer' },
  'composer-1': { input: 1.25, cacheWrite: 1.25, cacheRead: 0.125, output: 10.0, pool: 'auto_composer' },
  'composer-2': { input: 0.5, cacheWrite: 0.5, cacheRead: 0.2, output: 2.5, pool: 'auto_composer' },
  'composer-2-fast': { input: 1.0, cacheWrite: 1.0, cacheRead: 0.4, output: 5.0, pool: 'auto_composer' },
  'composer-2.5': { input: 0.5, cacheWrite: 0.5, cacheRead: 0.2, output: 2.5, pool: 'auto_composer' },
  'composer-2.5-fast': { input: 3.0, cacheWrite: 3.0, cacheRead: 0.5, output: 15.0, pool: 'auto_composer' },
  'gpt-5.2': { input: 1.75, cacheWrite: 1.75, cacheRead: 0.175, output: 14.0, pool: 'api' },
  'gpt-5.2-codex': { input: 1.75, cacheWrite: 1.75, cacheRead: 0.175, output: 14.0, pool: 'api' },
  'gpt-5.3-codex': { input: 1.75, cacheWrite: 1.75, cacheRead: 0.175, output: 14.0, pool: 'api' },
  'gpt-5.3-codex-high': { input: 1.75, cacheWrite: 1.75, cacheRead: 0.175, output: 14.0, pool: 'api' },
  'gpt-5.4-medium': { input: 2.5, cacheWrite: 2.5, cacheRead: 0.25, output: 15.0, pool: 'api' },
  'gpt-5.5-medium': { input: 5.0, cacheWrite: 5.0, cacheRead: 0.5, output: 30.0, pool: 'api' },
  'claude-4.5-sonnet-thinking': { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0, pool: 'api' },
  'claude-4.6-sonnet-medium-thinking': { input: 3.0, cacheWrite: 3.75, cacheRead: 0.3, output: 15.0, pool: 'api' },
  'claude-4.6-opus-high-thinking': { input: 5.0, cacheWrite: 6.25, cacheRead: 0.5, output: 25.0, pool: 'api' },
  'claude-opus-4-7-thinking-high': { input: 5.0, cacheWrite: 6.25, cacheRead: 0.5, output: 25.0, pool: 'api' },
  agent_review: { input: 1.25, cacheWrite: 1.25, cacheRead: 0.25, output: 6.0, pool: 'api' },
}

export function rowCost(
  model: string,
  icw: number,
  icwo: number,
  cr: number,
  out: number,
  maxMode = false,
): number {
  if (model === 'agent_review') {
    const p = PRICING.auto
    return tokenRowCost(p, icw, icwo, cr, out) * AGENT_REVIEW_DISCOUNT_RATIO
  }
  const pricing = PRICING[model]
  if (!pricing) return 0
  const adjusted = maxModeAdjustedCost(model, pricing, icw, icwo, cr, out, maxMode)
  if (adjusted !== null) return adjusted
  return tokenRowCost(pricing, icw, icwo, cr, out)
}

export function resolveRowCost(
  rowCostValue: string | undefined | null,
  model: string,
  icw: number,
  icwo: number,
  cr: number,
  out: number,
  maxMode = false,
): number {
  const annotated = parseOfficialRowCost(rowCostValue)
  if (annotated !== null) return annotated
  return rowCost(model, icw, icwo, cr, out, maxMode)
}
