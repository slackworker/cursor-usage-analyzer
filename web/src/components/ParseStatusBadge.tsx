import { FREE_STATUS_ONLY_SKIP } from '../lib/pricing'

const EXPECTED_SKIP_LABELS: Record<string, string> = {
  'Errored, No Charge': '出错未计费',
  'Aborted, Not Charged': '中止未计费',
  [FREE_STATUS_ONLY_SKIP]: 'Free 状态行',
}

interface ParseStatusBadgeProps {
  unknownModels?: Record<string, number>
  skippedRows?: Record<string, number>
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${EXPECTED_SKIP_LABELS[key] ?? key} ${count}`)
    .join(' · ')
}

export function ParseStatusBadge({ unknownModels, skippedRows }: ParseStatusBadgeProps) {
  const unknownEntries = unknownModels ? Object.entries(unknownModels) : []
  const skippedEntries = skippedRows ? Object.entries(skippedRows) : []
  const hasUnknown = unknownEntries.length > 0

  if (!hasUnknown) {
    return (
      <span className="report-badge" onClick={(e) => e.stopPropagation()}>
        已解析
      </span>
    )
  }

  return (
    <details className="parse-details" onClick={(e) => e.stopPropagation()}>
      <summary className="report-badge report-badge--warn">数据质量提示</summary>
      <div className="parse-details__panel" role="status">
        <p className="parse-details__item">
          <span className="parse-details__label">未知模型</span>
          {unknownEntries.map(([model, count]) => (
            <span key={model} className="parse-details__tag">
              {model} ×{count}
            </span>
          ))}
        </p>
        {skippedEntries.length > 0 && (
          <p className="parse-details__item parse-details__item--muted">
            <span className="parse-details__label">未计入行</span>
            <span>{formatCounts(Object.fromEntries(skippedEntries))}</span>
          </p>
        )}
      </div>
    </details>
  )
}
