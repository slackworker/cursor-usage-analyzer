import type { EChartsOption } from 'echarts'
import { EChart, CHART_COLORS, baseGrid, baseLegend, baseTooltip } from './EChart'

interface ModelChartProps {
  byModel: Record<string, { cost: number; tokens: number }>
  view: 'cost' | 'token'
  chartType: 'pie' | 'bar'
  onViewChange: (v: 'cost' | 'token') => void
  onChartTypeChange: (v: 'pie' | 'bar') => void
}

export function ModelChart({
  byModel,
  view,
  chartType,
  onViewChange,
  onChartTypeChange,
}: ModelChartProps) {
  const sorted = Object.entries(byModel)
    .map(([model, v]) => ({ model, value: view === 'cost' ? v.cost : v.tokens }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const option: EChartsOption =
    chartType === 'pie'
      ? {
          tooltip: baseTooltip(),
          legend: { ...baseLegend(), type: 'scroll', bottom: 0 },
          series: [
            {
              type: 'pie',
              radius: '65%',
              center: ['50%', '45%'],
              data: sorted.map((d) => ({ name: d.model, value: d.value })),
              label: { color: '#e6edf3', fontSize: 10 },
              color: CHART_COLORS,
            },
          ],
        }
      : {
          tooltip: { trigger: 'axis', backgroundColor: '#161b22', borderColor: '#30363d' },
          grid: baseGrid(),
          xAxis: {
            type: 'value',
            axisLabel: { color: '#8b949e' },
            splitLine: { lineStyle: { color: '#21262d' } },
          },
          yAxis: {
            type: 'category',
            data: sorted.map((d) => d.model).reverse(),
            axisLabel: { color: '#8b949e', fontSize: 10 },
          },
          series: [
            {
              type: 'bar',
              data: sorted.map((d) => d.value).reverse(),
              itemStyle: { color: CHART_COLORS[0] },
            },
          ],
        }

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
        <button
          type="button"
          className={chartType === 'pie' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onChartTypeChange('pie')}
        >
          饼图
        </button>
        <button
          type="button"
          className={chartType === 'bar' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onChartTypeChange('bar')}
        >
          条图
        </button>
      </div>
      <EChart option={option} height={240} />
    </div>
  )
}
