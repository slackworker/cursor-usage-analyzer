import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildUsageSummary, rollupBillingTotals } from './aggregation'
import { parseCsvText } from './parser'
import { hasLocalExample, localExamplePath } from '../test/localExamples'

const calibrationPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../tests/calibration_cases.json',
)
const calibrationData = JSON.parse(readFileSync(calibrationPath, 'utf-8')) as {
  cases: CalibrationCaseJson[]
}

type BillingMode = 'official' | 'standard'

interface ModeExpectJson {
  total_cost: number
  total_spend?: number
  free_cost?: number
  total_delta?: number
}

interface CalibrationCaseJson {
  name: string
  filename: string
  official?: ModeExpectJson
  standard?: ModeExpectJson
}

function expectedSpend(mode: ModeExpectJson): number {
  return mode.total_spend ?? mode.total_cost
}

function modeCases(caseDef: CalibrationCaseJson): Array<{ mode: BillingMode; expect: ModeExpectJson }> {
  const out: Array<{ mode: BillingMode; expect: ModeExpectJson }> = []
  if (caseDef.official) out.push({ mode: 'official', expect: caseDef.official })
  if (caseDef.standard) out.push({ mode: 'standard', expect: caseDef.standard })
  return out
}

describe('golden CSV alignment', () => {
  for (const caseDef of calibrationData.cases) {
    for (const { mode, expect: modeExpect } of modeCases(caseDef)) {
      const delta = modeExpect.total_delta ?? 0.05
      const spend = expectedSpend(modeExpect)

      it.skipIf(!hasLocalExample(caseDef.filename))(
        `${caseDef.name} / ${caseDef.filename} (${mode})`,
        () => {
          const content = readFileSync(localExamplePath(caseDef.filename), 'utf-8')
          const { events } = parseCsvText(content, caseDef.filename)
          const totals = rollupBillingTotals(events, mode)
          const summary = buildUsageSummary(events, mode)

          expect(totals.total).toBeCloseTo(spend, 1)
          expect(summary.totalCost).toBeCloseTo(spend, 1)
          expect(Math.abs(totals.total - spend)).toBeLessThanOrEqual(delta + 0.01)
          if (modeExpect.free_cost != null && modeExpect.free_cost > 0) {
            expect(summary.freeCost).toBeCloseTo(modeExpect.free_cost, 1)
          }
        },
      )
    }
  }
})
