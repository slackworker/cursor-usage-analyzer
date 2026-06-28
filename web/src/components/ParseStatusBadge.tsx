import { useEffect, useRef, useState } from 'react'
import { FREE_STATUS_ONLY_SKIP } from '../lib/pricing'

const EXPECTED_SKIP_LABELS: Record<string, string> = {
  'Errored, No Charge': '出错',
  'Aborted, Not Charged': '中止',
  [FREE_STATUS_ONLY_SKIP]: 'Free',
}

interface ParseStatusBadgeProps {
  unknownModels?: Record<string, number>
  skippedRows?: Record<string, number>
}

export function ParseStatusBadge({ unknownModels, skippedRows }: ParseStatusBadgeProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const unknownEntries = unknownModels ? Object.entries(unknownModels) : []
  const skippedEntries = skippedRows ? Object.entries(skippedRows) : []
  const hasUnknown = unknownEntries.length > 0
  const hasSkipped = skippedEntries.length > 0
  const isExpandable = hasUnknown || hasSkipped

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  if (!isExpandable) {
    return (
      <span className="report-badge report-badge--static" onClick={(e) => e.stopPropagation()}>
        已解析
      </span>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`parse-details${open ? ' parse-details--open' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`report-badge parse-details__trigger${hasUnknown ? ' report-badge--warn' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        {hasUnknown ? '含未知模型' : '已解析'}
      </button>
      {open ? (
        <div className="parse-details__panel" role="status">
          {hasUnknown ? (
            <p className="parse-details__item">
              <span className="parse-details__label">未知模型</span>
              <span className="parse-details__content">
                {unknownEntries.map(([model, count]) => (
                  <span key={model} className="parse-details__tag">
                    {model} ×{count}
                  </span>
                ))}
              </span>
            </p>
          ) : null}
          {hasSkipped ? (
            <p className="parse-details__item">
              <span className="parse-details__label">无需计入</span>
              <span className="parse-details__content">
                {[...skippedEntries]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, count]) => (
                    <span key={key} className="parse-details__tag parse-details__tag--muted">
                      {EXPECTED_SKIP_LABELS[key] ?? key} ×{count}
                    </span>
                  ))}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
