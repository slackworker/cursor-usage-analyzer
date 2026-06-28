import { formatUsd } from '../../hooks/useReport'
import { PLAN_PRESETS, type PlanId } from '../../lib/types'

interface PoolProjectionProps {
  projection: {
    spanDays: number
    autoComposerPct: number
    apiPct: number
    usageMode: 'direct' | 'normalized'
    acUsed: number
    apiUsed: number
    startDate: string
    endDate: string
  }
  plan: PlanId
  limits: { autoComposer: number; api: number }
  onPlanChange: (plan: PlanId) => void
  onLimitsChange: (patch: Partial<{ autoComposer: number; api: number }>) => void
}

function PoolGauge({
  label,
  pct,
  used,
  limit,
  fillClass,
}: {
  label: string
  pct: number
  used: number
  limit: number
  fillClass: 'pool-gauge__fill--ac' | 'pool-gauge__fill--api'
}) {
  return (
    <div className="pool-gauge">
      <div className="pool-gauge__header">
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="pool-gauge__bar">
        <div
          className={`pool-gauge__fill ${fillClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="pool-gauge__sub">
        {formatUsd(used)} / {formatUsd(limit)}
      </span>
    </div>
  )
}

export function PoolProjection({
  projection,
  plan,
  limits,
  onPlanChange,
  onLimitsChange,
}: PoolProjectionProps) {
  const isDirect = projection.usageMode === 'direct'

  return (
    <div className="pool-projection">
      <div className="pool-projection__config">
        <label className="pool-projection__field pool-projection__field--plan">
          <span className="pool-projection__field-label">套餐</span>
          <select
            className="filter-bar__select"
            value={plan}
            onChange={(e) => onPlanChange(e.target.value as PlanId)}
          >
            {(Object.entries(PLAN_PRESETS) as [PlanId, (typeof PLAN_PRESETS)[PlanId]][]).map(
              ([id, preset]) => (
                <option key={id} value={id}>
                  {preset.label}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="pool-projection__field">
          <span className="pool-projection__field-label">Auto+Composer 额度 ($)</span>
          <input
            type="number"
            className="filter-bar__input"
            value={limits.autoComposer}
            min={1}
            step={1}
            onChange={(e) => onLimitsChange({ autoComposer: Number(e.target.value) })}
          />
        </label>
        <label className="pool-projection__field">
          <span className="pool-projection__field-label">API 额度 ($)</span>
          <input
            type="number"
            className="filter-bar__input"
            value={limits.api}
            min={1}
            step={1}
            onChange={(e) => onLimitsChange({ api: Number(e.target.value) })}
          />
        </label>
      </div>

      <section className="pool-projection__usage">
        <h4 className="pool-projection__section-title">
          {isDirect ? '月度使用率' : '月均推算'}
        </h4>
        <div className="pool-gauges">
          <PoolGauge
            label="Auto + Composer"
            pct={projection.autoComposerPct}
            used={projection.acUsed}
            limit={limits.autoComposer}
            fillClass="pool-gauge__fill--ac"
          />
          <PoolGauge
            label="API"
            pct={projection.apiPct}
            used={projection.apiUsed}
            limit={limits.api}
            fillClass="pool-gauge__fill--api"
          />
        </div>
      </section>

      <p className="pool-projection__hint">
        {isDirect
          ? `数据 ${projection.startDate} 至 ${projection.endDate}（在一个账单月内），按 Included 直接占月度额度。`
          : `数据 ${projection.startDate} 至 ${projection.endDate}（跨账单月），按日均 Included 归一化至 30 天；仅供参考。`}
      </p>
    </div>
  )
}
