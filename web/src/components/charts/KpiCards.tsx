import { formatTokens, formatUsd } from '../../hooks/useReport'
import type { BillingTotals } from '../../lib/types'

interface KpiCardsProps {
  billing: BillingTotals
  totalTokens: number
  days: number
  peakDate: string | null
  peakValue: number
}

export function KpiCards({ billing, totalTokens, days, peakDate, peakValue }: KpiCardsProps) {
  const dailyAvg = days > 0 ? billing.total / days : 0

  const items = [
    { label: '总费用', value: formatUsd(billing.total) },
    { label: '总 Token', value: formatTokens(totalTokens) },
    { label: '日均费用', value: formatUsd(dailyAvg) },
    {
      label: '峰值日',
      value: peakDate ? `${peakDate.slice(5)} · ${formatUsd(peakValue)}` : '—',
    },
  ]

  return (
    <div className="report-grid report-grid--kpi-inner">
      {items.map((item) => (
        <div key={item.label} className="kpi-card">
          <p className="kpi-card__label">{item.label}</p>
          <p className="kpi-card__value">{item.value}</p>
        </div>
      ))}
    </div>
  )
}
