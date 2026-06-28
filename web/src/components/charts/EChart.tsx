import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import {
  CHART_COLORS,
  baseGrid,
  baseLegend,
  baseTooltip,
  bottomLegend,
  darkChartBase,
  gridWithLegend,
  legendExtraHeight,
  pieChartHeight,
} from '../../lib/chartTheme'

interface EChartProps {
  option: EChartsOption
  height?: number | string
  onChartReady?: (chart: unknown) => void
  notMerge?: boolean
  replaceMerge?: string | string[]
}

export function EChart({
  option,
  height = 220,
  onChartReady,
  notMerge,
  replaceMerge,
}: EChartProps) {
  return (
    <ReactECharts
      option={{ ...darkChartBase, ...option }}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      onChartReady={onChartReady}
      notMerge={notMerge}
      replaceMerge={replaceMerge}
    />
  )
}

export {
  CHART_COLORS,
  baseGrid,
  baseLegend,
  baseTooltip,
  bottomLegend,
  gridWithLegend,
  legendExtraHeight,
  pieChartHeight,
}
