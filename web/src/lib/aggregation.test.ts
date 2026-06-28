import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  defaultHeatmapYear,
  filterHeatmapByYear,
  heatmapYears,
  rollupDaily,
} from './aggregation'
import { parseCsvText } from './parser'

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
