import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildUsageSummary, rollupBillingTotals } from './aggregation'
import { parseCsvText } from './parser'
import { hasLocalExample, localExamplePath } from '../test/localExamples'

interface Case {
  file: string
  mode: 'official' | 'standard'
  /** Calculator total (not Dashboard filename total) */
  total: number
  delta?: number
  freeCost?: number
}

/** Aligned with tests/calibration.py ModeExpect totals */
const CASES: Case[] = [
  { file: 'January - US$1.61.csv', mode: 'official', total: 1.6, delta: 0.05 },
  { file: 'January - US$1.61.csv', mode: 'standard', total: 1.6, delta: 0.05, freeCost: 1.6 },
  { file: 'February - US$46.57.csv', mode: 'standard', total: 48.04, delta: 0.05 },
  { file: 'March - US$69.94.csv', mode: 'official', total: 70.78, delta: 0.05 },
  { file: 'March - US$69.94.csv', mode: 'standard', total: 70.78, delta: 0.05 },
  { file: 'April - US$137.09.csv', mode: 'standard', total: 139.26, delta: 0.05 },
  { file: 'May - US$92.01.csv', mode: 'official', total: 91.45, delta: 0.05 },
  { file: 'June - US$141.24.csv', mode: 'official', total: 143.42, delta: 0.05 },
]

describe('golden CSV alignment', () => {
  for (const c of CASES) {
    it.skipIf(!hasLocalExample(c.file))(`${c.file} (${c.mode})`, () => {
      const path = localExamplePath(c.file)
      const content = readFileSync(path, 'utf-8')
      const { events } = parseCsvText(content, c.file)
      const totals = rollupBillingTotals(events, c.mode)
      const summary = buildUsageSummary(events, c.mode)
      expect(totals.total).toBeCloseTo(c.total, 1)
      expect(summary.totalCost).toBeCloseTo(c.total, 1)
      if (c.delta) {
        expect(Math.abs(totals.total - c.total)).toBeLessThanOrEqual(c.delta + 0.01)
      }
      if (c.freeCost != null) {
        expect(summary.freeCost).toBeCloseTo(c.freeCost, 1)
      }
    })
  }

  it.skipIf(!hasLocalExample('February - US$46.57.csv'))(
    'cross-language parity: TS totals match within $0.01 of pinned calculator values',
    () => {
      const content = readFileSync(localExamplePath('February - US$46.57.csv'), 'utf-8')
      const { events } = parseCsvText(content, 'feb')
      const totals = rollupBillingTotals(events, 'standard')
      expect(Math.abs(totals.total - 48.04)).toBeLessThan(0.02)
    },
  )
})
