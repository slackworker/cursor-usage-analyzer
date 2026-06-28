export const CHART_COLORS = [
  '#58a6ff',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#a371f7',
  '#39c5cf',
  '#db6d28',
  '#8b949e',
  '#ff7b72',
  '#79c0ff',
]

export const darkChartBase = {
  backgroundColor: 'transparent',
  textStyle: { color: '#8b949e', fontFamily: 'system-ui, sans-serif' },
}

export function baseTooltip() {
  return {
    trigger: 'item' as const,
    backgroundColor: '#161b22',
    borderColor: '#30363d',
    textStyle: { color: '#e6edf3' },
  }
}

export function formatChartUsd(value: number): string {
  return `$${value.toFixed(2)}`
}

type TooltipParam = {
  axisValue?: string
  marker?: string
  seriesName?: string
  value?: number | string
  name?: string
  percent?: number
}

function firstTooltipParam(params: unknown): TooltipParam | undefined {
  return (Array.isArray(params) ? params[0] : params) as TooltipParam | undefined
}

/** ECharts axis tooltip：费用列统一保留两位小数 */
export function axisTooltipUsdFormatter(params: unknown): string {
  const items = (Array.isArray(params) ? params : [params]) as TooltipParam[]
  if (!items.length) return ''

  const lines: string[] = []
  if (items[0].axisValue) lines.push(String(items[0].axisValue))

  for (const item of items) {
    const value = item.value
    const text = typeof value === 'number' ? formatChartUsd(value) : String(value ?? '')
    lines.push(`${item.marker ?? ''}${item.seriesName}: ${text}`)
  }

  return lines.join('<br/>')
}

/** ECharts 饼图 tooltip：费用保留两位小数 */
export function pieUsdTooltipFormatter(params: unknown): string {
  const item = firstTooltipParam(params)
  if (!item || typeof item.value !== 'number') return ''
  const pct = item.percent != null ? ` (${item.percent}%)` : ''
  return `${item.name}: ${formatChartUsd(item.value)}${pct}`
}

/** ECharts 饼图 label：费用保留两位小数 */
export function pieUsdLabelFormatter(params: unknown): string {
  const item = params as TooltipParam
  if (!item?.name || typeof item.value !== 'number') return ''
  return `${item.name}\n${formatChartUsd(item.value)}`
}

export function usdAxisLabel(value: number): string {
  return value.toFixed(2)
}

export function baseGrid() {
  return { left: 48, right: 16, top: 32, bottom: 32, containLabel: true }
}

export function baseLegend() {
  return {
    textStyle: { color: '#8b949e', fontSize: 11 },
  }
}

const LEGEND_ITEM_WIDTH = 100
const LEGEND_ROW_HEIGHT = 22

/** report-grid 窄列（1fr）环图的估算宽度 */
export const NARROW_CHART_WIDTH = 280

/** 估算横向图例行数，用于为多行图例预留空间 */
export function legendRowCount(itemCount: number, chartWidth = 900): number {
  if (itemCount <= 0) return 0
  const itemsPerRow = Math.max(1, Math.floor((chartWidth * 0.92) / LEGEND_ITEM_WIDTH))
  return Math.ceil(itemCount / itemsPerRow)
}

/** 图例超过一行时额外需要的高度（px） */
export function legendExtraHeight(itemCount: number, chartWidth = 900): number {
  const rows = legendRowCount(itemCount, chartWidth)
  return Math.max(0, (rows - 1) * LEGEND_ROW_HEIGHT)
}

/** 底部图例：plain 类型自动换行，展示全部项 */
export function bottomLegend() {
  return {
    ...baseLegend(),
    type: 'plain' as const,
    bottom: 0,
    left: 'center' as const,
    width: '92%',
    itemGap: 10,
    itemWidth: 14,
    itemHeight: 10,
  }
}

export function gridWithLegend(itemCount: number) {
  const rows = legendRowCount(itemCount)
  const bottom = 32 + Math.max(0, rows - 1) * LEGEND_ROW_HEIGHT
  return { ...baseGrid(), bottom }
}

/** 带底部图例的饼图/环形图高度 */
export function pieChartHeight(
  itemCount: number,
  baseHeight = 240,
  chartWidth = 900,
): number {
  return baseHeight + legendExtraHeight(itemCount, chartWidth)
}

const DONUT_TOP_PADDING = 24
const DONUT_LEGEND_BOTTOM = 6

/** 环图 center / radius：为顶部标签与底部图例留出空间，避免重叠裁切 */
export function donutSeriesLayout(
  itemCount: number,
  height: number,
  chartWidth = NARROW_CHART_WIDTH,
) {
  const rows = legendRowCount(itemCount, chartWidth)
  const legendPx = rows * LEGEND_ROW_HEIGHT + DONUT_LEGEND_BOTTOM
  const avail = Math.max(56, height - legendPx - DONUT_TOP_PADDING)
  const centerY = ((DONUT_TOP_PADDING + avail / 2) / height) * 100
  const outerPct = Math.min(62, Math.round((avail / height) * 100 * 0.88))
  const innerPct = Math.round(outerPct * (45 / 70))
  return {
    center: ['50%', `${centerY.toFixed(1)}%`] as [string, string],
    radius: [`${innerPct}%`, `${outerPct}%`] as [string, string],
  }
}

/** 横向条形图：按行数撑高，保证每行 Y 轴标签有足够空间 */
export function horizontalBarHeight(rowCount: number, minHeight = 180): number {
  if (rowCount === 0) return minHeight
  return Math.max(minHeight, rowCount * 26 + 48)
}

export function horizontalBarYAxisLabel() {
  return { color: '#8b949e', fontSize: 10, interval: 0 as const }
}

export function horizontalBarGrid() {
  return { left: 8, right: 16, top: 8, bottom: 8, containLabel: true }
}
