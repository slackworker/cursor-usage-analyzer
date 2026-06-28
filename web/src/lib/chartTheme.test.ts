import { describe, expect, it } from 'vitest'
import {
  axisTooltipUsdFormatter,
  donutSeriesLayout,
  formatChartUsd,
  legendRowCount,
  NARROW_CHART_WIDTH,
  pieChartHeight,
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

describe('donut layout', () => {
  it('legendRowCount wraps long labels in narrow columns', () => {
    expect(legendRowCount(3, NARROW_CHART_WIDTH)).toBeGreaterThan(1)
  })

  it('pieChartHeight grows for multi-row legends in narrow columns', () => {
    expect(pieChartHeight(3, 200, NARROW_CHART_WIDTH)).toBeGreaterThan(200)
  })

  it('donutSeriesLayout keeps center above legend area', () => {
    const height = pieChartHeight(3, 200, NARROW_CHART_WIDTH)
    const layout = donutSeriesLayout(3, height, NARROW_CHART_WIDTH)
    const centerY = Number.parseFloat(layout.center[1])
    const outerR = Number.parseFloat(layout.radius[1])
    expect(centerY).toBeLessThan(50)
    expect(outerR).toBeLessThanOrEqual(62)
    expect(height).toBeGreaterThan(200)
  })
})
