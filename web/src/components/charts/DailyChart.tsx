import type { EChartsOption } from 'echarts'
import { EChart, CHART_COLORS, baseGrid, baseLegend } from './EChart'

interface DailyChartProps {
  daily: { date: string; byModel: Record<string, number> }[]
  cumulative: { date: string; cumulative: number }[]
  showCumulative: boolean
  onToggleCumulative: (v: boolean) => void
}

export function DailyChart({ daily, cumulative, showCumulative, onToggleCumulative }: DailyChartProps) {
  const dates = daily.map((d) => d.date)
  const models = [...new Set(daily.flatMap((d) => Object.keys(d.byModel)))].sort()

  const series: EChartsOption['series'] = models.map((model, i) => ({
    name: model,
    type: 'bar',
    stack: 'daily',
    data: daily.map((d) => d.byModel[model] ?? 0),
    itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
  }))

  if (showCumulative) {
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
  }

  const option: EChartsOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#161b22', borderColor: '#30363d' },
    legend: { ...baseLegend(), type: 'scroll', bottom: 0 },
    grid: baseGrid(),
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#8b949e', fontSize: 10, rotate: dates.length > 14 ? 45 : 0 },
    },
    yAxis: [
      {
        type: 'value',
        name: '费用',
        axisLabel: { color: '#8b949e' },
        splitLine: { lineStyle: { color: '#21262d' } },
      },
      ...(showCumulative
        ? [
            {
              type: 'value' as const,
              name: '累积',
              axisLabel: { color: '#8b949e' },
              splitLine: { show: false },
            },
          ]
        : []),
    ],
    series,
  }

  return (
    <div className="chart-with-controls">
      <label className="chart-controls__check">
        <input
          type="checkbox"
          checked={showCumulative}
          onChange={(e) => onToggleCumulative(e.target.checked)}
        />
        累积折线叠层
      </label>
      <EChart option={option} height={260} />
    </div>
  )
}
