import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailyChart } from './DailyChart'

const daily: { date: string; byModel: Record<string, number> }[] = [
  { date: '06-01', byModel: { auto: 1, gpt: 10 } },
  { date: '06-02', byModel: { auto: 1 } },
]
const cumulative = [
  { date: '06-01', cumulative: 3 },
  { date: '06-02', cumulative: 6 },
]

const onViewChange = vi.fn()

let lastEChartProps: {
  option: {
    series?: { name?: string }[]
    legend?: { data?: string[] }
    yAxis?: { name?: string; axisLabel?: { formatter?: (v: number) => string } }[]
    tooltip?: { formatter?: unknown }
  }
  replaceMerge?: string | string[]
} | null = null

vi.mock('./EChart', () => ({
  EChart: (props: {
    option: {
      series?: { name?: string }[]
      legend?: { data?: string[] }
      yAxis?: { name?: string; axisLabel?: { formatter?: (v: number) => string } }[]
      tooltip?: { formatter?: unknown }
    }
    replaceMerge?: string | string[]
  }) => {
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
    onViewChange.mockClear()
  })

  function renderChart(view: 'cost' | 'token' = 'cost') {
    return render(
      <DailyChart daily={daily} cumulative={cumulative} view={view} onViewChange={onViewChange} />,
    )
  }

  it('passes replaceMerge for series, yAxis, and legend updates', () => {
    renderChart()

    expect(lastEChartProps?.replaceMerge).toEqual(['series', 'yAxis', 'legend'])
  })

  it('always includes cumulative line series', () => {
    renderChart()

    expect(lastEChartProps?.option.series?.some((s) => s.name === '累积')).toBe(true)
    expect(lastEChartProps?.option.yAxis).toHaveLength(2)
  })

  it('uses cost axis labels by default', () => {
    renderChart('cost')

    expect(lastEChartProps?.option.yAxis?.[0]?.name).toBe('费用')
    expect(lastEChartProps?.option.yAxis?.[0]?.axisLabel?.formatter?.(1.2)).toBe('1.20')
  })

  it('uses token axis labels in token view', () => {
    renderChart('token')

    expect(lastEChartProps?.option.yAxis?.[0]?.name).toBe('Token')
    expect(lastEChartProps?.option.yAxis?.[0]?.axisLabel?.formatter?.(1500)).toBe('1.5K')
  })

  it('calls onViewChange when toggling view', () => {
    renderChart('cost')

    fireEvent.click(screen.getByRole('button', { name: 'Token' }))
    expect(onViewChange).toHaveBeenCalledWith('token')
  })

  it('sorts legend by total usage while keeping series stack order alphabetical', () => {
    renderChart('token')

    const barSeries = lastEChartProps?.option.series?.filter((s) => s.name !== '累积') ?? []
    expect(barSeries.map((s) => s.name)).toEqual(['auto', 'gpt'])
    expect(lastEChartProps?.option.legend?.data).toEqual(['gpt', 'auto', '累积'])
  })
})
