import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailyChart } from './DailyChart'

const daily: { date: string; byModel: Record<string, number> }[] = [
  { date: '06-01', byModel: { auto: 1, gpt: 10 } },
  { date: '06-02', byModel: { auto: 1 } },
]
const cumulative = [
  { date: '06-01', cumulative: 11 },
  { date: '06-02', cumulative: 12 },
]

const onViewChange = vi.fn()
const onLayoutChange = vi.fn()

let lastEChartProps: {
  buildOption?: (chartWidth: number) => {
    series?: { name?: string; type?: string; stack?: string; areaStyle?: unknown }[]
    legend?: { data?: string[] }
    yAxis?: { name?: string; axisLabel?: { formatter?: (v: number) => string } }[]
    tooltip?: {
      formatter?: unknown
      textStyle?: { fontSize?: number }
      extraCssText?: string
      enterable?: boolean
    }
  }
  replaceMerge?: string | string[]
} | null = null

vi.mock('./EChart', () => ({
  EChart: (props: {
    buildOption?: (chartWidth: number) => {
      series?: { name?: string; type?: string; stack?: string; areaStyle?: unknown }[]
      legend?: { data?: string[] }
      yAxis?: { name?: string; axisLabel?: { formatter?: (v: number) => string } }[]
      tooltip?: {
      formatter?: unknown
      textStyle?: { fontSize?: number }
      extraCssText?: string
      enterable?: boolean
    }
    }
    replaceMerge?: string | string[]
  }) => {
    lastEChartProps = props
    return <div data-testid="echart-mock" />
  },
  CHART_COLORS: ['#000', '#111'],
  bottomLegend: () => ({}),
  gridWithLegend: () => ({}),
  legendExtraHeight: () => 0,
}))

describe('DailyChart', () => {
  afterEach(() => {
    cleanup()
    lastEChartProps = null
    onViewChange.mockClear()
    onLayoutChange.mockClear()
  })

  function renderChart(
    view: 'cost' | 'token' = 'cost',
    layout: 'bar' | 'stack' = 'bar',
  ) {
    return render(
      <DailyChart
        daily={daily}
        cumulative={cumulative}
        view={view}
        layout={layout}
        onViewChange={onViewChange}
        onLayoutChange={onLayoutChange}
      />,
    )
  }

  function getOption() {
    return lastEChartProps?.buildOption?.(900)
  }

  it('passes replaceMerge for series, yAxis, legend, and tooltip updates', () => {
    renderChart()

    expect(lastEChartProps?.replaceMerge).toEqual(['series', 'yAxis', 'legend', 'tooltip'])
  })

  it('includes cumulative line series in bar layout', () => {
    renderChart()

    expect(getOption()?.series?.some((s) => s.name === '累积')).toBe(true)
    expect(getOption()?.yAxis).toHaveLength(2)
  })

  it('uses stacked area series in stack layout', () => {
    renderChart('cost', 'stack')

    const series = getOption()?.series ?? []
    expect(series.every((s) => s.type === 'line' && s.stack === 'cumulative')).toBe(true)
    expect(series.every((s) => s.areaStyle)).toBe(true)
    expect(series.some((s) => s.name === '累积')).toBe(false)
    expect(getOption()?.yAxis).toHaveLength(1)
    expect(getOption()?.yAxis?.[0]?.name).toBe('累积费用')
  })

  it('uses cost axis labels by default', () => {
    renderChart('cost')

    expect(getOption()?.yAxis?.[0]?.name).toBe('费用')
    expect(getOption()?.yAxis?.[0]?.axisLabel?.formatter?.(1.2)).toBe('1.20')
  })

  it('uses token axis labels in token view', () => {
    renderChart('token')

    expect(getOption()?.yAxis?.[0]?.name).toBe('Token')
    expect(getOption()?.yAxis?.[0]?.axisLabel?.formatter?.(1500)).toBe('1.5K')
  })

  it('calls onViewChange when toggling view', () => {
    renderChart('cost')

    fireEvent.click(screen.getByRole('button', { name: 'Token' }))
    expect(onViewChange).toHaveBeenCalledWith('token')
  })

  it('calls onLayoutChange when toggling layout', () => {
    renderChart('cost', 'bar')

    fireEvent.click(screen.getByRole('button', { name: '堆叠' }))
    expect(onLayoutChange).toHaveBeenCalledWith('stack')
  })

  it('sorts legend and stack by total usage descending', () => {
    renderChart('token')

    const barSeries = getOption()?.series?.filter((s) => s.name !== '累积') ?? []
    expect(barSeries.map((s) => s.name)).toEqual(['gpt', 'auto'])
    expect(getOption()?.legend?.data).toEqual(['gpt', 'auto', '累积'])
  })

  it('uses compact tooltip styling only in stack layout', () => {
    renderChart('cost', 'bar')
    expect(getOption()?.tooltip?.textStyle?.fontSize).toBeUndefined()
    expect(getOption()?.tooltip?.extraCssText).toBeUndefined()

    renderChart('cost', 'stack')
    expect(getOption()?.tooltip?.textStyle?.fontSize).toBe(10)
    expect(getOption()?.tooltip?.extraCssText).toBeUndefined()
    expect(getOption()?.tooltip?.enterable).toBeUndefined()
  })

  it('builds cumulative stacked values per model in stack layout', () => {
    renderChart('token', 'stack')

    const gpt = getOption()?.series?.find((s) => s.name === 'gpt') as { data?: number[] }
    const auto = getOption()?.series?.find((s) => s.name === 'auto') as { data?: number[] }
    expect(gpt?.data).toEqual([10, 10])
    expect(auto?.data).toEqual([1, 2])
  })
})
