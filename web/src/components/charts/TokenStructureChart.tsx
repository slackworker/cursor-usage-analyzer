import type { EChartsOption } from 'echarts'
import { formatTokens } from '../../hooks/useReport'
import { EChart, baseLegend, baseTooltip } from './EChart'

interface TokenStructureChartProps {
  tokens: { icw: number; icwo: number; cacheRead: number; output: number }
}

const TOKEN_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f85149']

export function TokenStructureChart({ tokens }: TokenStructureChartProps) {
  const data = [
    { name: 'ICW', value: tokens.icw },
    { name: 'ICWO', value: tokens.icwo },
    { name: 'Cache Read', value: tokens.cacheRead },
    { name: 'Output', value: tokens.output },
  ].filter((d) => d.value > 0)

  const option: EChartsOption = {
    tooltip: {
      ...baseTooltip(),
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params
        if (!p || typeof p.value !== 'number') return ''
        return `${p.name}: ${formatTokens(p.value)} (${p.percent}%)`
      },
    },
    legend: { ...baseLegend(), bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        data,
        label: {
          color: '#e6edf3',
          formatter: ({ name, percent }) => `${name}\n${percent}%`,
        },
        color: TOKEN_COLORS,
      },
    ],
  }

  return <EChart option={option} height={240} />
}
