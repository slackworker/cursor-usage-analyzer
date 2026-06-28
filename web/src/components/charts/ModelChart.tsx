import type { EChartsOption } from 'echarts'
import { formatTokens } from '../../hooks/useReport'
import {
  pieLabelMinShowAngle,
  pieUsdLabelFormatter,
  pieUsdTooltipFormatter,
} from '../../lib/chartTheme'
import { EChart, CHART_COLORS, baseTooltip } from './EChart'

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

  const option: EChartsOption = {
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
    series: [
      {
        type: 'pie',
        radius: '65%',
        center: ['50%', '50%'],
        minShowLabelAngle: pieLabelMinShowAngle(),
        data: sorted.map((d) => ({ name: d.model, value: d.value })),
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
      <EChart option={option} height={240} />
    </div>
  )
}
