import { formatUsd } from '../../hooks/useReport'

interface PoolProjectionProps {
  projection: {
    spanDays: number
    dailyAvg: number
    projected30d: number
    autoComposerPct: number
    apiPct: number
    totalPct: number
  }
  limits: { autoComposer: number; api: number }
  byPool: Record<string, { included: number; free: number; onDemand: number }>
  open: boolean
  onToggle: (v: boolean) => void
  onLimitsChange: (patch: Partial<{ autoComposer: number; api: number }>) => void
}

export function PoolProjection({
  projection,
  limits,
  byPool,
  open,
  onToggle,
  onLimitsChange,
}: PoolProjectionProps) {
  const acUsed =
    (byPool.auto_composer?.included ?? 0) +
    (byPool.auto_composer?.free ?? 0) +
    (byPool.auto_composer?.onDemand ?? 0)
  const apiUsed =
    (byPool.api?.included ?? 0) + (byPool.api?.free ?? 0) + (byPool.api?.onDemand ?? 0)

  const acPct = limits.autoComposer ? (acUsed / limits.autoComposer) * 100 : 0
  const apiPct = limits.api ? (apiUsed / limits.api) * 100 : 0

  return (
    <footer className="report-footer">
      <div className="pool-gauges">
        <div className="pool-gauge">
          <div className="pool-gauge__header">
            <span>Auto + Composer</span>
            <span>{acPct.toFixed(1)}%</span>
          </div>
          <div className="pool-gauge__bar">
            <div className="pool-gauge__fill pool-gauge__fill--ac" style={{ width: `${Math.min(acPct, 100)}%` }} />
          </div>
          <span className="pool-gauge__sub">
            {formatUsd(acUsed)} / {formatUsd(limits.autoComposer)}
          </span>
        </div>
        <div className="pool-gauge">
          <div className="pool-gauge__header">
            <span>API</span>
            <span>{apiPct.toFixed(1)}%</span>
          </div>
          <div className="pool-gauge__bar">
            <div className="pool-gauge__fill pool-gauge__fill--api" style={{ width: `${Math.min(apiPct, 100)}%` }} />
          </div>
          <span className="pool-gauge__sub">
            {formatUsd(apiUsed)} / {formatUsd(limits.api)}
          </span>
        </div>
      </div>

      <div className="pool-limits-config">
        <label>
          AC 额度 $
          <input
            type="number"
            className="filter-bar__input"
            value={limits.autoComposer}
            min={1}
            step={1}
            onChange={(e) => onLimitsChange({ autoComposer: Number(e.target.value) })}
          />
        </label>
        <label>
          API 额度 $
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

      <details className="projection-details" open={open} onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}>
        <summary className="projection-details__summary">Usage 推算 #14（实验性）</summary>
        <div className="projection-details__body">
          <p className="projection-disclaimer">
            ⚠️ 免责声明：此推算基于当前 CSV 片段按 30 天归一化，非完整账单周期，非 Pro 套餐时不准确。仅供参考，不构成账单承诺。
          </p>
          <ul className="projection-stats">
            <li>数据跨度：{projection.spanDays} 天</li>
            <li>日均 Included：{formatUsd(projection.dailyAvg)}</li>
            <li>30 天推算：{formatUsd(projection.projected30d)}</li>
            <li>推算 AC 池使用率：{projection.autoComposerPct.toFixed(1)}%</li>
            <li>推算 API 池使用率：{projection.apiPct.toFixed(1)}%</li>
          </ul>
        </div>
      </details>

      <div className="report-actions">
        <button type="button" className="report-actions__btn" disabled title="二期功能">
          对比 CSV（即将推出）
        </button>
      </div>
    </footer>
  )
}
