import type { EChartsOption } from 'echarts'
import { useEffect, useMemo, useState } from 'react'
import { defaultHeatmapYear, filterHeatmapByYear, heatmapYears } from '../../lib/aggregation'
import { activitySlotTooltip } from '../../lib/chartTheme'
import { EChart, baseTooltip } from './EChart'

interface YearHeatmapProps {
  data: { date: string; value: number }[]
}

export function YearHeatmap({ data }: YearHeatmapProps) {
  const years = useMemo(() => heatmapYears(data), [data])
  const [selectedYear, setSelectedYear] = useState(() => defaultHeatmapYear(years) ?? '')

  useEffect(() => {
    if (!years.length) return
    if (!years.includes(selectedYear)) {
      setSelectedYear(defaultHeatmapYear(years)!)
    }
  }, [years, selectedYear])

  const yearData = useMemo(
    () => (selectedYear ? filterHeatmapByYear(data, selectedYear) : []),
    [data, selectedYear],
  )

  if (!data.length) {
    return <p className="chart-empty">无数据</p>
  }

  if (!yearData.length) {
    return <p className="chart-empty">无数据</p>
  }

  const max = Math.max(...yearData.map((d) => d.value), 1)

  const option: EChartsOption = {
    tooltip: {
      ...baseTooltip(),
      formatter: (p: unknown) => {
        const params = p as { value: [string, number] }
        return activitySlotTooltip(params.value[0], params.value[1], 'sessions')
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
      range: [selectedYear],
      itemStyle: { color: '#161b22', borderWidth: 2, borderColor: '#0d1117' },
      dayLabel: { color: '#8b949e', fontSize: 10 },
      monthLabel: { color: '#8b949e' },
      yearLabel: { color: '#e6edf3', position: 'right', margin: 8, fontSize: 13 },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: yearData.map((d) => [d.date, d.value]),
      },
    ],
  }

  return (
    <div className="chart-with-controls">
      {years.length > 1 && (
        <div className="chart-controls">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={selectedYear === year ? 'chart-controls__btn--active' : 'chart-controls__btn'}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      )}
      <EChart option={option} height={180} />
    </div>
  )
}
