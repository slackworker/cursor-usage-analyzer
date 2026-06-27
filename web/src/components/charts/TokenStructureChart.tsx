import type { EChartsOption } from 'echarts'
import { EChart, baseGrid, baseLegend, baseTooltip } from './EChart'

interface TokenStructureChartProps {
  tokens: { icw: number; icwo: number; cacheRead: number; output: number }
}

export function TokenStructureChart({ tokens }: TokenStructureChartProps) {
  const option: EChartsOption = {
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    legend: { ...baseLegend(), bottom: 0 },
    grid: baseGrid(),
    xAxis: { type: 'category', data: ['Token 结构'], axisLabel: { show: false } },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e', formatter: (v: number) => `${(v / 1e6).toFixed(1)}M` },
      splitLine: { lineStyle: { color: '#21262d' } },
    },
    series: [
      { name: 'ICW', type: 'bar', stack: 't', data: [tokens.icw], itemStyle: { color: '#58a6ff' } },
      { name: 'ICWO', type: 'bar', stack: 't', data: [tokens.icwo], itemStyle: { color: '#3fb950' } },
      { name: 'Cache Read', type: 'bar', stack: 't', data: [tokens.cacheRead], itemStyle: { color: '#d29922' } },
      { name: 'Output', type: 'bar', stack: 't', data: [tokens.output], itemStyle: { color: '#f85149' } },
    ],
  }

  return <EChart option={option} height={240} />
}
