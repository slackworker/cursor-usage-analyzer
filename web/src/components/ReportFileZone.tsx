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

function DropZoneIcon() {
  return (
    <svg className="report-file-zone__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

export function ReportFileZone({ fileName, meta, rowCount, onFileSelect }: ReportFileZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isDragging, error: dropError, dropTargetProps } = useCsvFileDrop(onFileSelect)

  const hintText = isDragging
    ? '松开鼠标以更换文件'
    : fileName
      ? '拖拽 CSV 到此处，或点击更换文件'
      : '拖拽 CSV 到此处，或点击选择文件'

  return (
    <section
      className={`report-file-zone${isDragging ? ' report-file-zone--drag-active' : ''}`}
      aria-label="数据文件"
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

      <div className="report-file-zone__header">
        {fileName ? (
          <>
            <p className="report-file-zone__name">
              <span className="report-file-zone__filename">{fileName}</span>
            </p>
            <p className="report-file-zone__meta">
              <span>
                {meta?.dateFrom && meta?.dateTo
                  ? `${meta.dateFrom} ~ ${meta.dateTo}`
                  : '日期范围 —'}
              </span>
              <span>{rowCount.toLocaleString()} 行</span>
              <ParseStatusBadge unknownModels={meta?.unknownModels} skippedRows={meta?.skippedRows} />
            </p>
          </>
        ) : (
          <p className="report-file-zone__name report-file-zone__name--empty">尚未加载 CSV</p>
        )}
      </div>

      <button
        type="button"
        className="report-file-zone__drop-center"
        data-export-hide
        aria-label={hintText}
        onClick={() => fileInputRef.current?.click()}
      >
        <DropZoneIcon />
        <span className="report-file-zone__hint">{hintText}</span>
      </button>

      {dropError ? <p className="report-file-zone__error">{dropError}</p> : null}
    </section>
  )
}
