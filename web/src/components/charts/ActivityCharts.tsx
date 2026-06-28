import type { EChartsOption } from 'echarts'
import {
  activityAxisOrder,
  activityLabelStep,
  formatActivitySlotLabel,
  WEEKLY_ACTIVITY_GRANULARITY,
} from '../../lib/aggregation'
import type { ActivityGranularity } from '../../lib/types'
import { ACTIVITY_GRANULARITY_OPTIONS } from '../../lib/types'
import { EChart, baseGrid } from './EChart'

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

interface HourlyChartProps {
  hourly: { slot: number; value: number }[]
  view: 'sessions' | 'tokens'
  granularity: ActivityGranularity
  onViewChange: (v: 'sessions' | 'tokens') => void
  onGranularityChange: (v: ActivityGranularity) => void
}

export function HourlyChart({
  hourly,
  view,
  granularity,
  onViewChange,
  onGranularityChange,
}: HourlyChartProps) {
  const axisOrder = activityAxisOrder(granularity)
  const labelStep = activityLabelStep(granularity)
  const ordered = axisOrder.map((s) => hourly[s] ?? { slot: s, value: 0 })
  const labels = ordered.map((h) => formatActivitySlotLabel(h.slot, granularity))

  const option: EChartsOption = {
    tooltip: { trigger: 'axis', backgroundColor: '#161b22', borderColor: '#30363d' },
    grid: baseGrid(),
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        color: '#8b949e',
        fontSize: granularity <= 15 ? 8 : 9,
        interval: 0,
        formatter: (value: string, index: number) => (index % labelStep === 0 ? value : ''),
      },
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
        <span className="chart-controls__divider" aria-hidden="true" />
        {ACTIVITY_GRANULARITY_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={granularity === value ? 'chart-controls__btn--active' : 'chart-controls__btn'}
            onClick={() => onGranularityChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <EChart option={option} height={200} />
    </div>
  )
}

interface WeeklyHeatmapProps {
  matrix: number[][]
}

export function WeeklyHeatmap({ matrix }: WeeklyHeatmapProps) {
  const axisOrder = activityAxisOrder(WEEKLY_ACTIVITY_GRANULARITY)
  const labelStep = activityLabelStep(WEEKLY_ACTIVITY_GRANULARITY)
  const slotLabels = axisOrder.map((slot) =>
    formatActivitySlotLabel(slot, WEEKLY_ACTIVITY_GRANULARITY),
  )
  const data: [number, number, number][] = []
  let max = 0
  for (let dow = 0; dow < 7; dow++) {
    for (let xi = 0; xi < axisOrder.length; xi++) {
      const slot = axisOrder[xi]
      const v = matrix[dow]?.[slot] ?? 0
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
        const slot = axisOrder[xi] ?? xi
        const label = formatActivitySlotLabel(slot, WEEKLY_ACTIVITY_GRANULARITY)
        return `周${DAY_LABELS[dow]} ${label} — ${val} 次`
      },
    },
    grid: { height: '82%', top: 24, left: 48, right: 16, bottom: 28 },
    xAxis: {
      type: 'category',
      data: slotLabels,
      splitArea: { show: true },
      axisLabel: {
        color: '#8b949e',
        fontSize: 8,
        interval: 0,
        formatter: (value: string, index: number) => (index % labelStep === 0 ? value : ''),
      },
    },
    yAxis: {
      type: 'category',
      data: DAY_LABELS,
      splitArea: { show: true },
      axisLabel: { color: '#8b949e' },
    },
    visualMap: {
      show: false,
      min: 0,
      max: max || 1,
      inRange: { color: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] },
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
