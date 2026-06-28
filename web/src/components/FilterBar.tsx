import type { DateRangePreset, FilterState } from '../lib/types'

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '1d', label: '1 天' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
  { value: 'mtd', label: '本月' },
  { value: 'last_month', label: '上月' },
  { value: 'custom', label: '自定义' },
]

const BILLING_MODES: {
  value: FilterState['billingMode']
  label: string
  title: string
}[] = [
  { value: 'standard', label: '标准', title: '标准 (Inc+Free+OD)' },
  { value: 'official', label: '官方', title: '官方 (Inc+OD)' },
]

interface FilterBarProps {
  filters: FilterState
  onChange: (patch: Partial<FilterState>) => void
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const isCustom = filters.dateRange === 'custom'
  const customFrom =
    typeof filters.dateRange === 'object' ? filters.dateRange.from : ''
  const customTo = typeof filters.dateRange === 'object' ? filters.dateRange.to : ''
  const billingMode = BILLING_MODES.find((m) => m.value === filters.billingMode) ?? BILLING_MODES[0]

  return (
    <div className="filter-bar__controls">
      <label className="filter-bar__group">
        <span className="filter-bar__group-label">日期</span>
        <select
          className="filter-bar__select"
          value={isCustom || typeof filters.dateRange === 'object' ? 'custom' : filters.dateRange}
          onChange={(e) => {
            const v = e.target.value as DateRangePreset
            if (v === 'custom') {
              onChange({ dateRange: { from: customFrom, to: customTo } })
            } else {
              onChange({ dateRange: v })
            }
          }}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {(isCustom || typeof filters.dateRange === 'object') && (
        <>
          <label className="filter-bar__group">
            <span className="filter-bar__group-label">从</span>
            <input
              type="date"
              className="filter-bar__input"
              value={customFrom}
              onChange={(e) => onChange({ dateRange: { from: e.target.value, to: customTo } })}
            />
          </label>
          <label className="filter-bar__group">
            <span className="filter-bar__group-label">至</span>
            <input
              type="date"
              className="filter-bar__input"
              value={customTo}
              onChange={(e) => onChange({ dateRange: { from: customFrom, to: e.target.value } })}
            />
          </label>
        </>
      )}

      <label className="filter-bar__group" title={billingMode.title}>
        <span className="filter-bar__group-label">口径</span>
        <select
          className="filter-bar__select"
          value={filters.billingMode}
          title={billingMode.title}
          onChange={(e) => onChange({ billingMode: e.target.value as FilterState['billingMode'] })}
        >
          {BILLING_MODES.map((mode) => (
            <option key={mode.value} value={mode.value} title={mode.title}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
