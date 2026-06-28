import { describe, expect, it } from 'vitest'
import {
  axisTooltipUsdFormatter,
  formatChartUsd,
  pieUsdLabelFormatter,
  pieUsdTooltipFormatter,
} from './chartTheme'

describe('chartTheme USD formatters', () => {
  it('formatChartUsd keeps two decimal places', () => {
    expect(formatChartUsd(1.2)).toBe('$1.20')
    expect(formatChartUsd(48.045)).toBe('$48.05')
  })

  it('axisTooltipUsdFormatter formats numeric series values', () => {
    const html = axisTooltipUsdFormatter([
      { axisValue: '06-01', marker: '● ', seriesName: 'auto', value: 1.234 },
      { marker: '● ', seriesName: '累积', value: 12.3 },
    ])
    expect(html).toContain('06-01')
    expect(html).toContain('auto: $1.23')
    expect(html).toContain('累积: $12.30')
  })

  it('pieUsdTooltipFormatter includes percent when present', () => {
    expect(pieUsdTooltipFormatter({ name: 'Included', value: 3.456, percent: 42.1 })).toBe(
      'Included: $3.46 (42.1%)',
    )
  })

  it('pieUsdLabelFormatter shows name and USD on two lines', () => {
    expect(pieUsdLabelFormatter({ name: 'API', value: 9.1 })).toBe('API\n$9.10')
  })
})
