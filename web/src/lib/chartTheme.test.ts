import { describe, expect, it } from 'vitest'
import {
  activitySlotTooltip,
  axisTooltipTokenFormatter,
  axisTooltipUsdFormatter,
  donutSeriesLayout,
  formatChartTokens,
  formatChartUsd,
  gridWithLegend,
  legendRowCount,
  NARROW_CHART_WIDTH,
  pieChartHeight,
  pieLabelMinShowAngle,
  pieUsdLabelFormatter,
  pieUsdTooltipFormatter,
  stackAxisTooltipStyle,
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

  it('axisTooltipUsdFormatter omits zero-value series', () => {
    const html = axisTooltipUsdFormatter([
      { axisValue: '06-01', marker: '● ', seriesName: 'auto', value: 1.2 },
      { marker: '● ', seriesName: 'gpt', value: 0 },
      { marker: '● ', seriesName: 'claude', value: 0.5 },
    ])
    expect(html).toContain('auto: $1.20')
    expect(html).toContain('claude: $0.50')
    expect(html).not.toContain('gpt')
  })

  it('pieUsdTooltipFormatter includes percent when present', () => {
    expect(pieUsdTooltipFormatter({ name: 'Included', value: 3.456, percent: 42.1 })).toBe(
      'Included: $3.46 (42.1%)',
    )
  })

  it('pieUsdLabelFormatter shows name and USD on two lines', () => {
    expect(pieUsdLabelFormatter({ name: 'API', value: 9.1 })).toBe('API\n$9.10')
  })

  it('formatChartTokens uses compact units', () => {
    expect(formatChartTokens(1500)).toBe('1.5K')
    expect(formatChartTokens(2_500_000)).toBe('2.50M')
  })

  it('axisTooltipTokenFormatter formats numeric series values', () => {
    const html = axisTooltipTokenFormatter([
      { axisValue: '06-01', marker: '● ', seriesName: 'auto', value: 1500 },
      { marker: '● ', seriesName: '累积', value: 4500 },
    ])
    expect(html).toContain('06-01')
    expect(html).toContain('auto: 1.5K')
    expect(html).toContain('累积: 4.5K')
  })

  it('activitySlotTooltip uses em dash and 次 for sessions', () => {
    expect(activitySlotTooltip('14:00', 12, 'sessions')).toBe('14:00 — 12 次')
    expect(activitySlotTooltip('周一 14:00', 1200, 'tokens')).toBe('周一 14:00 — 1.2K')
  })

  it('pieLabelMinShowAngle hides labels at or below threshold percent', () => {
    expect(pieLabelMinShowAngle()).toBeGreaterThan(3.6)
    expect(pieLabelMinShowAngle()).toBeLessThan(3.7)
  })
})

describe('donut layout', () => {
  it('legendRowCount wraps long labels in narrow columns', () => {
    expect(legendRowCount(3, NARROW_CHART_WIDTH)).toBeGreaterThan(1)
  })

  it('pieChartHeight grows for multi-row legends in narrow columns', () => {
    expect(pieChartHeight(3, 200, NARROW_CHART_WIDTH)).toBeGreaterThan(200)
  })

  it('gridWithLegend reserves more bottom space for narrow widths', () => {
    const wide = gridWithLegend(8, 1200).bottom ?? 0
    const narrow = gridWithLegend(8, 400).bottom ?? 0
    expect(narrow).toBeGreaterThan(wide)
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

describe('stackAxisTooltipStyle', () => {
  it('keeps default font size when few models fit in chart height', () => {
    const style = stackAxisTooltipStyle(2, 260)
    expect(style.textStyle.fontSize).toBe(14)
    expect(style.extraCssText).toBeUndefined()
    expect(style.enterable).toBeUndefined()
  })

  it('shrinks font size when many models would overflow vertically', () => {
    const style = stackAxisTooltipStyle(12, 260)
    expect(style.textStyle.fontSize).toBeLessThan(14)
    expect(style.textStyle.fontSize).toBeGreaterThanOrEqual(9)
    expect(style.extraCssText).toBeUndefined()
  })

  it('adds scroll fallback when even minimum font overflows', () => {
    const style = stackAxisTooltipStyle(25, 260)
    expect(style.textStyle.fontSize).toBe(9)
    expect(style.extraCssText).toContain('max-height:')
    expect(style.extraCssText).toContain('overflow-y: auto')
    expect(style.enterable).toBe(true)
  })

  it('allows larger font when chart height grows with legend rows', () => {
    const compact = stackAxisTooltipStyle(12, 260)
    const tall = stackAxisTooltipStyle(12, 320)
    expect(tall.textStyle.fontSize).toBeGreaterThanOrEqual(compact.textStyle.fontSize)
  })

  it('uses 10px without scroll for ~16 models at typical chart height', () => {
    const style = stackAxisTooltipStyle(16, 304)
    expect(style.textStyle.fontSize).toBe(10)
    expect(style.extraCssText).toBeUndefined()
  })
})
