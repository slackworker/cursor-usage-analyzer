import type { ReactNode } from 'react'

interface ChartPanelProps {
  title: string
  placeholder?: string
  tall?: boolean
  children?: ReactNode
}

export function ChartPanel({
  title,
  placeholder = '暂无数据',
  tall = false,
  children,
}: ChartPanelProps) {
  return (
    <section className={`chart-panel${tall ? ' chart-panel--tall' : ''}`}>
      <h3 className="chart-panel__title">{title}</h3>
      <div className={`chart-panel__body${children ? ' chart-panel__body--filled' : ''}`}>
        {children ?? placeholder}
      </div>
    </section>
  )
}
