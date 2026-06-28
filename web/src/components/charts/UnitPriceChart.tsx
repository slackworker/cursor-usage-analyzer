import type { EChartsOption } from 'echarts'
import { horizontalBarGrid, horizontalBarHeight, horizontalBarYAxisLabel } from '../../lib/chartTheme'
import { EChart, baseTooltip } from './EChart'

interface UnitPriceChartProps {
  prices: Record<string, number>
}

export function UnitPriceChart({ prices }: UnitPriceChartProps) {
  const sorted = Object.entries(prices)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const option: EChartsOption = {
    tooltip: {
      ...baseTooltip(),
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        return p ? `${p.name}: $${p.value.toFixed(2)}/M tokens` : ''
      },
    },
    grid: horizontalBarGrid(),
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e' },
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
        itemStyle: { color: '#a371f7' },
      },
    ],
  }

  return <EChart option={option} height={horizontalBarHeight(sorted.length)} />
}
