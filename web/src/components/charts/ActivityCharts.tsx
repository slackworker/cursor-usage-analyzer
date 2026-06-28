import type { EChartsOption } from 'echarts'
import { EChart, baseGrid } from './EChart'

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/** 小时轴从 03:00 起，将深夜低活跃时段置于两端 */
const HOUR_AXIS_START = 3
const HOUR_AXIS_ORDER = Array.from({ length: 24 }, (_, i) => (HOUR_AXIS_START + i) % 24)

function formatHourLabel(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

interface HourlyChartProps {
  hourly: { hour: number; value: number }[]
  view: 'sessions' | 'tokens'
  onViewChange: (v: 'sessions' | 'tokens') => void
}

export function HourlyChart({ hourly, view, onViewChange }: HourlyChartProps) {
  const ordered = HOUR_AXIS_ORDER.map((h) => hourly[h] ?? { hour: h, value: 0 })

  const option: EChartsOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#161b22', borderColor: '#30363d' },
    grid: baseGrid(),
    xAxis: {
      type: 'category',
      data: ordered.map((h) => formatHourLabel(h.hour)),
      axisLabel: { color: '#8b949e', fontSize: 9, interval: 1 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8b949e' },
      splitLine: { lineStyle: { color: '#21262d' } },
    },
    series: [
      {
        type: 'bar',
        data: ordered.map((h) => h.value),
        itemStyle: { color: '#58a6ff' },
      },
    ],
  }

  return (
    <div className="chart-with-controls">
      <div className="chart-controls">
        <button
          type="button"
          className={view === 'sessions' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onViewChange('sessions')}
        >
          会话(行)
        </button>
        <button
          type="button"
          className={view === 'tokens' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onViewChange('tokens')}
        >
          Token
        </button>
      </div>
      <EChart option={option} height={200} />
    </div>
  )
}

interface WeeklyHeatmapProps {
  matrix: number[][]
}

export function WeeklyHeatmap({ matrix }: WeeklyHeatmapProps) {
  const data: [number, number, number][] = []
  let max = 0
  for (let dow = 0; dow < 7; dow++) {
    for (let xi = 0; xi < 24; xi++) {
      const hour = HOUR_AXIS_ORDER[xi]
      const v = matrix[dow]?.[hour] ?? 0
      if (v > max) max = v
      data.push([xi, dow, v])
    }
  }

  const option: EChartsOption = {
    tooltip: {
      position: 'top',
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      formatter: (p: unknown) => {
        const params = p as { value: [number, number, number] }
        const [xi, dow, val] = params.value
        const hour = HOUR_AXIS_ORDER[xi] ?? xi
        return `周${DAY_LABELS[dow]} ${formatHourLabel(hour)} — ${val} 次`
      },
    },
    grid: { height: '70%', top: 24, left: 48, right: 16 },
    xAxis: {
      type: 'category',
      data: HOUR_AXIS_ORDER.map(formatHourLabel),
      splitArea: { show: true },
      axisLabel: { color: '#8b949e', fontSize: 9, interval: 1 },
    },
    yAxis: {
      type: 'category',
      data: DAY_LABELS,
      splitArea: { show: true },
      axisLabel: { color: '#8b949e' },
    },
    visualMap: {
      min: 0,
      max: max || 1,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] },
      textStyle: { color: '#8b949e' },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 4 } },
      },
    ],
  }

  return <EChart option={option} height={200} />
}
