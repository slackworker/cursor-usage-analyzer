import type { EChartsOption } from 'echarts'
import { formatTokens } from '../../hooks/useReport'
import {
  pieLabelMinShowAngle,
  pieUsdLabelFormatter,
  pieUsdTooltipFormatter,
} from '../../lib/chartTheme'
import { EChart, CHART_COLORS, baseTooltip, bottomLegend, pieChartHeight, pieSeriesLayout } from './EChart'

interface ModelChartProps {
  byModel: Record<string, { cost: number; tokens: number }>
  view: 'cost' | 'token'
  onViewChange: (v: 'cost' | 'token') => void
}

export function ModelChart({ byModel, view, onViewChange }: ModelChartProps) {
  const sorted = Object.entries(byModel)
    .map(([model, v]) => ({ model, value: view === 'cost' ? v.cost : v.tokens }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const pieData = sorted.map((d) => ({ name: d.model, value: d.value }))

  const buildOption = (chartWidth: number): EChartsOption => {
    const height = pieChartHeight(pieData.length, 240, chartWidth)
    const layout = pieSeriesLayout(pieData.length, height, chartWidth)

    return {
      tooltip: {
        ...baseTooltip(),
        formatter:
          view === 'cost'
            ? pieUsdTooltipFormatter
            : (params) => {
                const item = (Array.isArray(params) ? params[0] : params) as {
                  name?: string
                  value?: number
                  percent?: number
                }
                if (!item || typeof item.value !== 'number') return ''
                return `${item.name}: ${formatTokens(item.value)} (${item.percent}%)`
              },
      },
      legend: { ...bottomLegend(), data: pieData.map((d) => d.name) },
      series: [
        {
          type: 'pie',
          ...layout,
          minShowLabelAngle: pieLabelMinShowAngle(),
          data: pieData,
          label: {
            color: '#e6edf3',
            fontSize: 10,
            formatter:
              view === 'cost'
                ? pieUsdLabelFormatter
                : ({ name, percent }) => `${name}\n${percent}%`,
          },
          color: CHART_COLORS,
        },
      ],
    }
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
      </div>
      <EChart
        buildOption={buildOption}
        buildHeight={(chartWidth) => pieChartHeight(pieData.length, 240, chartWidth)}
      />
    </div>
  )
}
