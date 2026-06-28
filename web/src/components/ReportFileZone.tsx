import { useRef } from 'react'
import type { ReportMeta } from '../lib/types'
import { useCsvFileDrop } from '../hooks/useCsvFileDrop'
import { ParseStatusBadge } from './ParseStatusBadge'

interface ReportFileZoneProps {
  fileName: string | null
  meta: ReportMeta | null
  rowCount: number
  onFileSelect: (file: File) => void | Promise<void>
}

export function ReportFileZone({ fileName, meta, rowCount, onFileSelect }: ReportFileZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isDragging, error: dropError, dropTargetProps } = useCsvFileDrop(onFileSelect)

  return (
    <section
      className={`report-file-zone${isDragging ? ' report-file-zone--drag-active' : ''}`}
      aria-label="数据文件"
      {...dropTargetProps}
    >
      <div className="report-file-zone__main">
        <div className="report-file-zone__icon" aria-hidden>
          CSV
        </div>
        <div className="report-file-zone__info">
          <p className="report-file-zone__name">{fileName ?? '未选择文件'}</p>
          <p className="report-file-zone__meta">
            <span>
              {meta?.dateFrom && meta?.dateTo
                ? `${meta.dateFrom} ~ ${meta.dateTo}`
                : '日期范围 —'}
            </span>
            <span className="report-file-zone__sep">·</span>
            <span>{rowCount.toLocaleString()} 行</span>
            <ParseStatusBadge unknownModels={meta?.unknownModels} skippedRows={meta?.skippedRows} />
          </p>
          <p className="report-file-zone__hint">
            {isDragging ? '松开鼠标以更换文件' : '拖拽 CSV 到此处，或点击右侧按钮更换文件'}
          </p>
        </div>
      </div>

      <div className="report-file-zone__actions" data-export-hide>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="report-file-zone__file-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onFileSelect(file)
            event.target.value = ''
          }}
          aria-hidden
        />
        <button
          type="button"
          className="report-btn report-btn--secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          更换文件
        </button>
      </div>

      {dropError ? <p className="report-file-zone__error">{dropError}</p> : null}
    </section>
  )
}
