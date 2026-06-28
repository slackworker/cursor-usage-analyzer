import type { EChartsOption } from 'echarts'
import { formatPct } from '../../hooks/useReport'
import { horizontalBarGrid, horizontalBarHeight, horizontalBarYAxisLabel } from '../../lib/chartTheme'
import { EChart, baseTooltip } from './EChart'

interface CacheHitChartProps {
  rates: Record<string, number>
}

export function CacheHitChart({ rates }: CacheHitChartProps) {
  const sorted = Object.entries(rates)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)

  const option: EChartsOption = {
    tooltip: {
      ...baseTooltip(),
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        return p ? `${p.name}: ${formatPct(p.value)}` : ''
      },
    },
    grid: horizontalBarGrid(),
    xAxis: {
      type: 'value',
      max: 1,
      axisLabel: { color: '#8b949e', formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
      splitLine: { lineStyle: { color: '#21262d' } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map(([m]) => m).reverse(),
      axisLabel: horizontalBarYAxisLabel(),
    },
    series: [
      {
        type: 'bar',
        data: sorted.map(([, v]) => v).reverse(),
        itemStyle: { color: '#39c5cf' },
      },
    ],
  }

  return <EChart option={option} height={horizontalBarHeight(sorted.length)} />
}
