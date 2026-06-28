import { useEffect, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import {
  CHART_COLORS,
  baseGrid,
  baseLegend,
  baseTooltip,
  baseAxisTooltip,
  bottomLegend,
  darkChartBase,
  donutSeriesLayout,
  gridWithLegend,
  legendExtraHeight,
  NARROW_CHART_WIDTH,
  pieChartHeight,
  pieSeriesLayout,
} from '../../lib/chartTheme'

const DEFAULT_CHART_WIDTH = 900

interface EChartProps {
  option?: EChartsOption
  /** Recomputed when the container width changes (for responsive legend layout). */
  buildOption?: (chartWidth: number) => EChartsOption
  height?: number | string
  buildHeight?: (chartWidth: number) => number | string
  onChartReady?: (chart: unknown) => void
  notMerge?: boolean
  replaceMerge?: string | string[]
}

export function EChart({
  option,
  buildOption,
  height = 220,
  buildHeight,
  onChartReady,
  notMerge,
  replaceMerge,
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateWidth = () => {
      const width = el.getBoundingClientRect().width
      if (width > 0) setChartWidth(width)
    }

    updateWidth()
    const ro = new ResizeObserver(() => updateWidth())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const resolvedOption = {
    ...darkChartBase,
    ...(buildOption ? buildOption(chartWidth) : option!),
  }
  const resolvedHeight = buildHeight ? buildHeight(chartWidth) : height

  return (
    <div ref={containerRef} className="chart-panel__echart-wrap">
      <ReactECharts
        className="chart-panel__echart"
        option={resolvedOption}
        style={{ height: resolvedHeight, width: '100%', minWidth: 0 }}
        opts={{ renderer: 'canvas' }}
        onChartReady={onChartReady}
        notMerge={notMerge}
        replaceMerge={replaceMerge}
      />
    </div>
  )
}

export {
  CHART_COLORS,
  baseGrid,
  baseLegend,
  baseTooltip,
  baseAxisTooltip,
  bottomLegend,
  donutSeriesLayout,
  gridWithLegend,
  legendExtraHeight,
  NARROW_CHART_WIDTH,
  pieChartHeight,
  pieSeriesLayout,
}
