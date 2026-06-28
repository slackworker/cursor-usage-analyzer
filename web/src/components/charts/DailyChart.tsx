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
  onViewChange: (v: 'cost' | 'token') => void
}

export function DailyChart({ daily, cumulative, view, onViewChange }: DailyChartProps) {
  const dates = daily.map((d) => d.date)
  const allModels = [...new Set(daily.flatMap((d) => Object.keys(d.byModel)))]
  const modelTotals = new Map(
    allModels.map((model) => [
      model,
      daily.reduce((sum, d) => sum + (d.byModel[model] ?? 0), 0),
    ]),
  )
  const models = allModels.sort(
    (a, b) => (modelTotals.get(b) ?? 0) - (modelTotals.get(a) ?? 0),
  )
  const legendData = [...models, '累积']
  const isCost = view === 'cost'

  const series: EChartsOption['series'] = models.map((model, i) => ({
    name: model,
    type: 'bar',
    stack: 'daily',
    data: daily.map((d) => d.byModel[model] ?? 0),
    itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
  }))

  series.push({
    name: '累积',
    type: 'line',
    yAxisIndex: 1,
    data: cumulative.map((d) => d.cumulative),
    itemStyle: { color: '#ffa657' },
    lineStyle: { width: 2 },
    smooth: true,
    showSymbol: false,
  })

  const legendCount = models.length + 1
  const axisLabelFormatter = isCost ? usdAxisLabel : tokenAxisLabel

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
    yAxis: [
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
      </div>
      <EChart
        buildOption={buildOption}
        buildHeight={(chartWidth) => 260 + legendExtraHeight(legendCount, chartWidth)}
        replaceMerge={['series', 'yAxis', 'legend']}
      />
    </div>
  )
}
