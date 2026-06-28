import type { EChartsOption } from 'echarts'
import { filterByModelTokenShare } from '../../lib/aggregation'
import {
  formatChartUsd,
  horizontalBarGrid,
  horizontalBarHeight,
  horizontalBarYAxisLabel,
  usdAxisLabel,
} from '../../lib/chartTheme'
import { EChart, baseTooltip } from './EChart'

interface UnitPriceChartProps {
  prices: Record<string, number>
  modelTokens: Record<string, number>
}

export function UnitPriceChart({ prices, modelTokens }: UnitPriceChartProps) {
  const sorted = filterByModelTokenShare(prices, modelTokens)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  const option: EChartsOption = {
    tooltip: {
      ...baseTooltip(),
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        return p ? `${p.name}: ${formatChartUsd(p.value)}/M tokens` : ''
      },
    },
    grid: horizontalBarGrid(),
    xAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', formatter: usdAxisLabel },
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
