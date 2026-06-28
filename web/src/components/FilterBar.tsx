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

interface FilterBarProps {
  filters: FilterState
  allModels: string[]
  onChange: (patch: Partial<FilterState>) => void
}

export function FilterBar({ filters, allModels, onChange }: FilterBarProps) {
  const isCustom = filters.dateRange === 'custom'
  const customFrom =
    typeof filters.dateRange === 'object' ? filters.dateRange.from : ''
  const customTo = typeof filters.dateRange === 'object' ? filters.dateRange.to : ''

  return (
    <div className="filter-bar" role="region" aria-label="筛选">
      <span className="filter-bar__label">筛选</span>

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

      <label className="filter-bar__group">
        <span className="filter-bar__group-label">口径</span>
        <select
          className="filter-bar__select"
          value={filters.billingMode}
          onChange={(e) => onChange({ billingMode: e.target.value as FilterState['billingMode'] })}
        >
          <option value="standard">标准 (Inc+Free+OD)</option>
          <option value="official">官方 (Inc+OD)</option>
        </select>
      </label>

      <details className="filter-bar__models">
        <summary className="filter-bar__models-summary">
          模型 {filters.models === 'all' ? '(全部)' : `(${filters.models.length})`}
        </summary>
        <div className="filter-bar__models-list">
          <label className="filter-bar__check">
            <input
              type="checkbox"
              checked={filters.models === 'all'}
              onChange={() => onChange({ models: 'all' })}
            />
            全部
          </label>
          {allModels.map((m) => (
            <label key={m} className="filter-bar__check">
              <input
                type="checkbox"
                checked={filters.models === 'all' || filters.models.includes(m)}
                onChange={(e) => {
                  if (filters.models === 'all') {
                    const next = e.target.checked
                      ? allModels
                      : allModels.filter((x) => x !== m)
                    onChange({ models: next.length === allModels.length ? 'all' : next })
                  } else {
                    const set = new Set(filters.models)
                    if (e.target.checked) set.add(m)
                    else set.delete(m)
                    const next = [...set]
                    onChange({ models: next.length === 0 || next.length === allModels.length ? 'all' : next })
                  }
                }}
              />
              {m}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
