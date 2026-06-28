import type { EChartsOption } from 'echarts'
import { formatTokens, formatUsd } from '../../hooks/useReport'
import { EChart, baseLegend, baseTooltip } from './EChart'

interface StructureData {
  icw: number
  icwo: number
  cacheRead: number
  output: number
}

interface TokenStructureChartProps {
  data: StructureData
  view: 'cost' | 'token'
  onViewChange: (v: 'cost' | 'token') => void
}

const TOKEN_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f85149']

export function TokenStructureChart({ data, view, onViewChange }: TokenStructureChartProps) {
  const rows = [
    { name: 'ICW', value: data.icw },
    { name: 'ICWO', value: data.icwo },
    { name: 'Cache Read', value: data.cacheRead },
    { name: 'Output', value: data.output },
  ].filter((d) => d.value > 0)

  const formatValue = view === 'cost' ? formatUsd : formatTokens

  const option: EChartsOption = {
    tooltip: {
      ...baseTooltip(),
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params
        if (!p || typeof p.value !== 'number') return ''
        return `${p.name}: ${formatValue(p.value)} (${p.percent}%)`
      },
    },
    legend: { ...baseLegend(), bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        data: rows,
        label: {
          color: '#e6edf3',
          formatter: ({ name, percent }) => `${name}\n${percent}%`,
        },
        color: TOKEN_COLORS,
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
