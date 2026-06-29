import type { EChartsOption } from 'echarts'
import {
  activityAxisOrder,
  activityLabelStep,
  formatActivitySlotLabel,
} from '../../lib/aggregation'
import type { DailyActivityGranularity, WeeklyActivityGranularity } from '../../lib/types'
import {
  DAILY_ACTIVITY_GRANULARITY_OPTIONS,
  WEEKLY_ACTIVITY_GRANULARITY_OPTIONS,
} from '../../lib/types'
import { activitySlotTooltip } from '../../lib/chartTheme'
import { EChart, baseGrid, baseAxisTooltip } from './EChart'

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

interface HourlyChartProps {
  hourly: { slot: number; value: number }[]
  view: 'sessions' | 'tokens'
  granularity: DailyActivityGranularity
  onViewChange: (v: 'sessions' | 'tokens') => void
  onGranularityChange: (v: DailyActivityGranularity) => void
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
    tooltip: {
      ...baseAxisTooltip(),
      formatter: (params: unknown) => {
        const item = (Array.isArray(params) ? params[0] : params) as {
          axisValue?: string
          value?: number
        }
        if (!item || typeof item.value !== 'number') return ''
        return activitySlotTooltip(String(item.axisValue ?? ''), item.value, view)
      },
    },
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
          会话
        </button>
        <button
          type="button"
          className={view === 'tokens' ? 'chart-controls__btn--active' : 'chart-controls__btn'}
          onClick={() => onViewChange('tokens')}
        >
          Token
        </button>
        <span className="chart-controls__divider" aria-hidden="true" />
        {DAILY_ACTIVITY_GRANULARITY_OPTIONS.map(({ value, label }) => (
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
  granularity: WeeklyActivityGranularity
  onGranularityChange: (v: WeeklyActivityGranularity) => void
}

export function WeeklyHeatmap({ matrix, granularity, onGranularityChange }: WeeklyHeatmapProps) {
  const axisOrder = activityAxisOrder(granularity)
  const labelStep = activityLabelStep(granularity)
  const slotLabels = axisOrder.map((slot) => formatActivitySlotLabel(slot, granularity))
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
        const label = formatActivitySlotLabel(slot, granularity)
        return activitySlotTooltip(`周${DAY_LABELS[dow]} ${label}`, val, 'sessions')
      },
    },
    grid: { height: '82%', top: 24, left: 48, right: 16, bottom: 28 },
    xAxis: {
      type: 'category',
      data: slotLabels,
      splitArea: { show: true },
      axisLabel: {
        color: '#8b949e',
        fontSize: granularity <= 15 ? 8 : 9,
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

  return (
    <div className="chart-with-controls">
      <div className="chart-controls">
        {WEEKLY_ACTIVITY_GRANULARITY_OPTIONS.map(({ value, label }) => (
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
