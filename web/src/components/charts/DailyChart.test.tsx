import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailyChart } from './DailyChart'

const daily = [
  { date: '06-01', byModel: { auto: 1, gpt: 2 } },
  { date: '06-02', byModel: { auto: 3 } },
]
const cumulative = [
  { date: '06-01', cumulative: 3 },
  { date: '06-02', cumulative: 6 },
]

let lastEChartProps: { option: { series?: { name?: string }[]; yAxis?: unknown[] }; replaceMerge?: string | string[] } | null =
  null

vi.mock('./EChart', () => ({
  EChart: (props: { option: { series?: { name?: string }[]; yAxis?: unknown[] }; replaceMerge?: string | string[] }) => {
    lastEChartProps = props
    return <div data-testid="echart-mock" />
  },
  CHART_COLORS: ['#000'],
  bottomLegend: () => ({}),
  gridWithLegend: () => ({}),
  legendExtraHeight: () => 0,
}))

describe('DailyChart', () => {
  afterEach(() => {
    cleanup()
    lastEChartProps = null
  })

  it('passes replaceMerge for series and yAxis updates', () => {
    render(<DailyChart daily={daily} cumulative={cumulative} />)

    expect(lastEChartProps?.replaceMerge).toEqual(['series', 'yAxis'])
  })

  it('always includes cumulative line series', () => {
    render(<DailyChart daily={daily} cumulative={cumulative} />)

    expect(lastEChartProps?.option.series?.some((s) => s.name === '累积')).toBe(true)
    expect(lastEChartProps?.option.yAxis).toHaveLength(2)
  })
})
