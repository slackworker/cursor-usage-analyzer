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
