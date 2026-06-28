import type { EChartsOption } from 'echarts'
import { formatChartUsd } from '../../lib/chartTheme'
import { EChart, baseTooltip } from './EChart'

interface YearHeatmapProps {
  data: { date: string; value: number }[]
}

export function YearHeatmap({ data }: YearHeatmapProps) {
  if (!data.length) {
    return <p className="chart-empty">无数据</p>
  }

  const max = Math.max(...data.map((d) => d.value), 1)

  const option: EChartsOption = {
    tooltip: {
      ...baseTooltip(),
      formatter: (p: unknown) => {
        const params = p as { value: [string, number] }
        return `${params.value[0]}: ${formatChartUsd(params.value[1])}`
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max,
      inRange: { color: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] },
    },
    calendar: {
      top: 40,
      left: 48,
      right: 32,
      cellSize: ['auto', 14],
      range: [data[0].date.slice(0, 4)],
      itemStyle: { color: '#161b22', borderWidth: 2, borderColor: '#0d1117' },
      dayLabel: { color: '#8b949e', fontSize: 10 },
      monthLabel: { color: '#8b949e' },
      yearLabel: { color: '#e6edf3', position: 'right', margin: 8, fontSize: 13 },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: data.map((d) => [d.date, d.value]),
      },
    ],
  }

  return <EChart option={option} height={180} />
}
