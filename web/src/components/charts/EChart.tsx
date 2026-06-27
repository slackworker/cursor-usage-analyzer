import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { CHART_COLORS, baseGrid, baseLegend, baseTooltip, darkChartBase } from '../../lib/chartTheme'

interface EChartProps {
  option: EChartsOption
  height?: number | string
  onChartReady?: (chart: unknown) => void
}

export function EChart({ option, height = 220, onChartReady }: EChartProps) {
  return (
    <ReactECharts
      option={{ ...darkChartBase, ...option }}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      onChartReady={onChartReady}
    />
  )
}

export { CHART_COLORS, baseGrid, baseLegend, baseTooltip }
