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

export function baseGrid() {
  return { left: 48, right: 16, top: 32, bottom: 32, containLabel: true }
}

export function baseLegend() {
  return {
    textStyle: { color: '#8b949e' },
    pageTextStyle: { color: '#8b949e' },
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
