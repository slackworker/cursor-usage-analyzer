import { useRef } from 'react'
import type { FilterState, ReportMeta } from '../lib/types'
import { useCsvFileDrop } from '../hooks/useCsvFileDrop'
import { FilterBar } from './FilterBar'
import { ParseStatusBadge } from './ParseStatusBadge'
import { ExportPngButton } from './charts/ExportPngButton'

interface ReportFileZoneProps {
  fileName: string | null
  meta: ReportMeta | null
  rowCount: number
  filters: FilterState
  onFiltersChange: (patch: Partial<FilterState>) => void
  onFileSelect: (file: File) => void | Promise<void>
}

function DropZoneIcon() {
  return (
    <svg className="report-file-zone__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

export function ReportFileZone({
  fileName,
  meta,
  rowCount,
  filters,
  onFiltersChange,
  onFileSelect,
}: ReportFileZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isDragging, error: dropError, dropTargetProps } = useCsvFileDrop(onFileSelect)

  const emptyHintText = '拖拽 CSV 到此处，或点击选择文件'
  const dragHintText = fileName ? '松开鼠标以更换文件' : '松开鼠标以加载文件'

  const dropAriaLabel = isDragging
    ? dragHintText
    : fileName
      ? `${fileName}，点击或拖拽更换文件`
      : emptyHintText

  return (
    <section
      className={`report-header-card${isDragging ? ' report-header-card--drag-active' : ''}`}
      aria-label="报告顶栏与数据文件"
      {...dropTargetProps}
    >
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

      <div className="report-header-card__upper">
        <div className="report-header-card__row report-header-card__row--titlebar">
          <h1 className="report-header-card__title">Cursor Usage 分析报告</h1>
          <div className="report-header-card__actions">
            <FilterBar filters={filters} onChange={onFiltersChange} />
            <ExportPngButton />
          </div>
        </div>

        {!fileName ? (
          <div className="report-header-card__row report-header-card__row--file">
            <span className="report-header-card__file-empty">尚未加载 CSV</span>
          </div>
        ) : null}
      </div>

      <div className="report-header-card__drop report-file-zone__drop">
        {fileName && !isDragging ? (
          <div
            className="report-file-zone__drop-center report-file-zone__drop-center--loaded"
            role="button"
            tabIndex={0}
            data-export-hide
            aria-label={dropAriaLabel}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <DropZoneIcon />
            <span className="report-file-zone__file-info">
              <span className="report-file-zone__filename">{fileName}</span>
              <span className="report-file-zone__info-meta">
                <span>
                  {meta?.dateFrom && meta?.dateTo
                    ? `${meta.dateFrom} ~ ${meta.dateTo}`
                    : '日期范围 —'}
                </span>
                <span>{rowCount.toLocaleString()} 行</span>
                <ParseStatusBadge
                  unknownModels={meta?.unknownModels}
                  skippedRows={meta?.skippedRows}
                />
              </span>
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="report-file-zone__drop-center"
            data-export-hide
            aria-label={dropAriaLabel}
            onClick={() => fileInputRef.current?.click()}
          >
            <DropZoneIcon />
            {isDragging ? (
              <span className="report-file-zone__hint">{dragHintText}</span>
            ) : (
              <span className="report-file-zone__hint">{emptyHintText}</span>
            )}
          </button>
        )}

        {dropError ? <p className="report-file-zone__error">{dropError}</p> : null}
      </div>
    </section>
  )
}
