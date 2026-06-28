import type { EChartsOption } from 'echarts'
import type { BillingMode, BillingTotals } from '../../lib/types'
import { pieUsdLabelFormatter, pieUsdTooltipFormatter } from '../../lib/chartTheme'
import { EChart, bottomLegend, baseTooltip, CHART_COLORS, donutSeriesLayout, NARROW_CHART_WIDTH, pieChartHeight } from './EChart'

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

  const height = pieChartHeight(data.length, 200, NARROW_CHART_WIDTH)
  const layout = donutSeriesLayout(data.length, height, NARROW_CHART_WIDTH)

  const option: EChartsOption = {
    tooltip: { ...baseTooltip(), formatter: pieUsdTooltipFormatter },
    legend: bottomLegend(),
    series: [
      {
        type: 'pie',
        ...layout,
        data,
        label: { color: '#e6edf3', formatter: pieUsdLabelFormatter },
        color: CHART_COLORS,
      },
    ],
  }

  return <EChart option={option} height={height} />
}
