import type { EChartsOption } from 'echarts'
import type { BillingMode, BillingTotals } from '../../lib/types'
import { EChart, bottomLegend, baseTooltip, CHART_COLORS } from './EChart'

interface BillingDonutProps {
  totals: BillingTotals
  mode: BillingMode
}

export function BillingDonut({ totals, mode }: BillingDonutProps) {
  const data =
    mode === 'official'
      ? [
          { name: 'Included', value: totals.included },
          { name: 'On-demand', value: totals.onDemand },
        ].filter((d) => d.value > 0)
      : [
          { name: 'Included', value: totals.included },
          { name: 'Free', value: totals.free },
          { name: 'On-demand', value: totals.onDemand },
        ].filter((d) => d.value > 0)

  const option: EChartsOption = {
    tooltip: { ...baseTooltip(), formatter: '{b}: ${c} ({d}%)' },
    legend: bottomLegend(),
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        data,
        label: { color: '#e6edf3', formatter: '{b}\n${c}' },
        color: CHART_COLORS,
      },
    ],
  }

  return <EChart option={option} height={200} />
}
