import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  defaultHeatmapYear,
  filterByModelTokenShare,
  filterHeatmapByYear,
  heatmapYears,
  isWithinBillingCycle,
  projectUsagePercent,
  rollupDaily,
  tokenTotalsByModel,
} from './aggregation'
import { parseCsvText } from './parser'
import { DEFAULT_POOL_LIMITS } from './types'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function dayTotal(row: { byModel: Record<string, number> }): number {
  return Object.values(row.byModel).reduce((a, b) => a + b, 0)
}

describe('rollupDaily', () => {
  it('fills zero-usage dates between first and last day', () => {
    const content = readFileSync(join(root, 'examples/usage-events-2026-06-27.csv'), 'utf-8')
    const { events } = parseCsvText(content, 'usage-events.csv')

    const daily = rollupDaily(events, 'cost')
    const dates = daily.map((d) => d.date)

    expect(dates[0]).toBe('2026-06-04')
    expect(dates.at(-1)).toBe('2026-06-25')
    expect(dates).toHaveLength(22)

    const zeroDays = daily.filter((d) => dayTotal(d) === 0)
    expect(zeroDays.length).toBeGreaterThan(0)
    expect(zeroDays.every((d) => Object.keys(d.byModel).length === 0)).toBe(true)
  })

  it('respects explicit date bounds for preset ranges', () => {
    const content = readFileSync(join(root, 'examples/usage-events-2026-06-27.csv'), 'utf-8')
    const { events } = parseCsvText(content, 'usage-events.csv')

    const daily = rollupDaily(events, 'cost', 'all', 'standard', {
      from: '2026-06-20',
      to: '2026-06-25',
    })

    expect(daily.map((d) => d.date)).toEqual([
      '2026-06-20',
      '2026-06-21',
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
    ])
  })
})

describe('filterByModelTokenShare', () => {
  it('keeps models at or above 1% of total tokens', () => {
    const modelTokens = { 'model-a': 500, 'model-b': 40, 'model-c': 4 }
    const data = { 'model-a': 0.8, 'model-b': 0.5, 'model-c': 0.2 }
    const filtered = filterByModelTokenShare(data, modelTokens)
    expect(filtered.map(([m]) => m)).toEqual(['model-a', 'model-b'])
  })
})

describe('tokenTotalsByModel', () => {
  it('sums tokens per model from parsed events', () => {
    const content = readFileSync(join(root, 'examples/usage-events-2026-06-27.csv'), 'utf-8')
    const { events } = parseCsvText(content, 'usage-events.csv')
    const totals = tokenTotalsByModel(events)
    expect(Object.keys(totals).length).toBeGreaterThan(0)
    expect(Object.values(totals).every((n) => n > 0)).toBe(true)
  })
})

describe('year heatmap helpers', () => {
  const crossYear = [
    { date: '2025-11-01', value: 1 },
    { date: '2025-12-31', value: 2 },
    { date: '2026-01-01', value: 3 },
    { date: '2026-03-15', value: 4 },
  ]

  it('extracts sorted unique years', () => {
    expect(heatmapYears(crossYear)).toEqual(['2025', '2026'])
  })

  it('defaults to the latest year', () => {
    expect(defaultHeatmapYear(['2025', '2026'])).toBe('2026')
  })

  it('filters data by selected year', () => {
    expect(filterHeatmapByYear(crossYear, '2025')).toEqual([
      { date: '2025-11-01', value: 1 },
      { date: '2025-12-31', value: 2 },
    ])
    expect(filterHeatmapByYear(crossYear, '2026')).toEqual([
      { date: '2026-01-01', value: 3 },
      { date: '2026-03-15', value: 4 },
    ])
  })
})

describe('isWithinBillingCycle', () => {
  it('treats same-day-next-month as within one billing cycle', () => {
    expect(isWithinBillingCycle('2026-05-07', '2026-06-07')).toBe(true)
    expect(isWithinBillingCycle('2026-05-07', '2026-05-20')).toBe(true)
  })

  it('treats day after anniversary as crossing billing cycle', () => {
    expect(isWithinBillingCycle('2026-05-07', '2026-06-08')).toBe(false)
  })

  it('clamps month-end anniversaries', () => {
    expect(isWithinBillingCycle('2026-01-31', '2026-02-28')).toBe(true)
    expect(isWithinBillingCycle('2026-01-31', '2026-03-01')).toBe(false)
  })
})

describe('projectUsagePercent', () => {
  it('uses direct pool usage when data stays within one billing month', () => {
    const content = readFileSync(join(root, 'examples/usage-events-2026-06-27.csv'), 'utf-8')
    const { events } = parseCsvText(content, 'usage-events.csv')
    const result = projectUsagePercent(events, DEFAULT_POOL_LIMITS, 'official')

    expect(result.spanDays).toBeLessThanOrEqual(30)
    expect(result.usageMode).toBe('direct')
    expect(isWithinBillingCycle(result.startDate, result.endDate)).toBe(true)
    expect(result.acUsed).toBeGreaterThan(0)
    expect(result.autoComposerPct).toBeCloseTo(
      (result.acUsed / DEFAULT_POOL_LIMITS.autoComposer) * 100,
      5,
    )
  })

  it('normalizes when data crosses a billing month boundary', () => {
    const content = readFileSync(join(root, 'examples/Jan 01 - Jun 27 US$488.45.csv'), 'utf-8')
    const { events } = parseCsvText(content, 'Jan-Jun.csv')
    const result = projectUsagePercent(events, DEFAULT_POOL_LIMITS, 'official')

    expect(isWithinBillingCycle(result.startDate, result.endDate)).toBe(false)
    expect(result.usageMode).toBe('normalized')
    expect(result.autoComposerPct).toBeCloseTo(
      (result.acUsed / DEFAULT_POOL_LIMITS.autoComposer) * 100,
      5,
    )
    expect(result.apiPct).toBeCloseTo((result.apiUsed / DEFAULT_POOL_LIMITS.api) * 100, 5)
  })
})
