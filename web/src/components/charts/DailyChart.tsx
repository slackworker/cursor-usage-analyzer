import type { EChartsOption } from 'echarts'
import {
  axisTooltipTokenFormatter,
  axisTooltipUsdFormatter,
  tokenAxisLabel,
  usdAxisLabel,
} from '../../lib/chartTheme'
import { EChart, CHART_COLORS, bottomLegend, gridWithLegend, legendExtraHeight } from './EChart'

interface DailyChartProps {
  daily: { date: string; byModel: Record<string, number> }[]
  cumulative: { date: string; cumulative: number }[]
  view: 'cost' | 'token'
  layout: 'bar' | 'stack'
  onViewChange: (v: 'cost' | 'token') => void
  onLayoutChange: (v: 'bar' | 'stack') => void
}

function sortModelsByTotal(daily: DailyChartProps['daily']): string[] {
  const allModels = [...new Set(daily.flatMap((d) => Object.keys(d.byModel)))]
  const modelTotals = new Map(
    allModels.map((model) => [
      model,
      daily.reduce((sum, d) => sum + (d.byModel[model] ?? 0), 0),
    ]),
  )
  return allModels.sort(
    (a, b) => (modelTotals.get(b) ?? 0) - (modelTotals.get(a) ?? 0),
  )
}

function cumulativeByModel(
  daily: DailyChartProps['daily'],
  models: string[],
): { date: string; byModel: Record<string, number> }[] {
  const running = new Map<string, number>()
  return daily.map(({ date, byModel }) => {
    const cumulative: Record<string, number> = {}
    for (const model of models) {
      running.set(model, (running.get(model) ?? 0) + (byModel[model] ?? 0))
      cumulative[model] = running.get(model)!
    }
    return { date, byModel: cumulative }
  })
}

export function DailyChart({
  daily,
  cumulative,
  view,
  layout,
  onViewChange,
  onLayoutChange,
}: DailyChartProps) {
  const dates = daily.map((d) => d.date)
  const models = sortModelsByTotal(daily)
  const isCost = view === 'cost'
  const isStack = layout === 'stack'
  const legendData = isStack ? models : [...models, '累积']
  const legendCount = legendData.length
  const axisLabelFormatter = isCost ? usdAxisLabel : tokenAxisLabel
  const cumulativeDaily = isStack ? cumulativeByModel(daily, models) : null

  const series: EChartsOption['series'] = isStack
    ? models.map((model, i) => ({
        name: model,
        type: 'line',
        stack: 'cumulative',
        smooth: true,
        showSymbol: false,
        data: cumulativeDaily!.map((d) => d.byModel[model] ?? 0),
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        areaStyle: { opacity: 0.78 },
        emphasis: { focus: 'series' },
      }))
    : [
        ...models.map((model, i) => ({
          name: model,
          type: 'bar' as const,
          stack: 'daily',
          data: daily.map((d) => d.byModel[model] ?? 0),
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
        {
          name: '累积',
          type: 'line' as const,
          yAxisIndex: 1,
          data: cumulative.map((d) => d.cumulative),
          itemStyle: { color: '#ffa657' },
          lineStyle: { width: 2 },
          smooth: true,
          showSymbol: false,
        },
      ]

  const buildOption = (chartWidth: number): EChartsOption => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      formatter: isCost ? axisTooltipUsdFormatter : axisTooltipTokenFormatter,
    },
    legend: { ...bottomLegend(), data: legendData },
    grid: gridWithLegend(legendCount, chartWidth),
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#8b949e', fontSize: 10, rotate: dates.length > 14 ? 45 : 0 },
    },
    yAxis: isStack
      ? [
          {
            type: 'value',
            name: isCost ? '累积费用' : '累积 Token',
            axisLabel: { color: '#8b949e', formatter: axisLabelFormatter },
            splitLine: { lineStyle: { color: '#21262d' } },
          },
        ]
      : [
          {
            type: 'value',
            name: isCost ? '费用' : 'Token',
            axisLabel: { color: '#8b949e', formatter: axisLabelFormatter },
            splitLine: { lineStyle: { color: '#21262d' } },
          },
          {
            type: 'value',
            name: '累积',
            axisLabel: { color: '#8b949e', formatter: axisLabelFormatter },
            splitLine: { show: false },
          },
        ],
    series,
  })

  return (
    <div className="chart-with-controls">
      <div className="chart-controls">
        <button
          type="button"
          className={view === 'cost' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onViewChange('cost')}
        >
          费用
        </button>
        <button
          type="button"
          className={view === 'token' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onViewChange('token')}
        >
          Token
        </button>
        <span className="chart-controls__divider" aria-hidden="true" />
        <button
          type="button"
          className={layout === 'bar' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onLayoutChange('bar')}
        >
          柱状
        </button>
        <button
          type="button"
          className={layout === 'stack' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onLayoutChange('stack')}
        >
          叠层
        </button>
      </div>
      <EChart
        buildOption={buildOption}
        buildHeight={(chartWidth) => 260 + legendExtraHeight(legendCount, chartWidth)}
        replaceMerge={['series', 'yAxis', 'legend']}
      />
    </div>
  )
}
