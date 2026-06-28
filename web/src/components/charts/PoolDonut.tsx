import type { EChartsOption } from 'echarts'
import { POOL_LABELS } from '../../lib/types'
import { pieUsdTooltipFormatter } from '../../lib/chartTheme'
import { EChart, bottomLegend, baseTooltip, donutSeriesLayout, NARROW_CHART_WIDTH, pieChartHeight } from './EChart'

interface PoolDonutProps {
  byPool: Record<string, { included: number; free: number; onDemand: number }>
  limits: { autoComposer: number; api: number }
}

export function PoolDonut({ byPool, limits }: PoolDonutProps) {
  const ac = (byPool.auto_composer?.included ?? 0) + (byPool.auto_composer?.free ?? 0) + (byPool.auto_composer?.onDemand ?? 0)
  const api = (byPool.api?.included ?? 0) + (byPool.api?.free ?? 0) + (byPool.api?.onDemand ?? 0)

  const data = [
    { name: POOL_LABELS.auto_composer ?? 'Auto+Composer', value: ac },
    { name: POOL_LABELS.api ?? 'API', value: api },
  ].filter((d) => d.value > 0)

  const acPct = limits.autoComposer ? (ac / limits.autoComposer) * 100 : 0
  const apiPct = limits.api ? (api / limits.api) * 100 : 0

  const height = pieChartHeight(data.length, 200, NARROW_CHART_WIDTH)
  const layout = donutSeriesLayout(data.length, height, NARROW_CHART_WIDTH)
  const centerY = Number.parseFloat(layout.center[1])

  const option: EChartsOption = {
    tooltip: { ...baseTooltip(), formatter: pieUsdTooltipFormatter },
    legend: bottomLegend(),
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: `${Math.max(12, centerY - 6).toFixed(1)}%`,
        style: {
          text: `AC ${acPct.toFixed(0)}% · API ${apiPct.toFixed(0)}%`,
          fill: '#8b949e',
          fontSize: 11,
        },
      },
    ],
    series: [
      {
        type: 'pie',
        ...layout,
        data,
        label: { color: '#e6edf3' },
        color: ['#3fb950', '#a371f7'],
      },
    ],
  }

  return <EChart option={option} height={height} />
}
