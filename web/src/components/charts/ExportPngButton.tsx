import html2canvas from 'html2canvas'
import { useState } from 'react'
import { useReportStore } from '../../store/reportStore'

function buildExportFileName(fileName: string | null): string {
  const base = fileName?.replace(/\.csv$/i, '') ?? 'cursor-usage-report'
  const sanitized = base.replace(/[^\w\u4e00-\u9fff.-]+/g, '_')
  return `${sanitized}.png`
}

export function ExportPngButton() {
  const fileName = useReportStore((s) => s.fileName)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    const container = document.querySelector<HTMLElement>('.report-container')
    if (!container || exporting) return

    setExporting(true)
    try {
      const canvas = await html2canvas(container, {
        backgroundColor: '#0d1117',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (doc) => {
          doc.querySelectorAll<HTMLElement>('[data-export-hide]').forEach((el) => {
            el.style.display = 'none'
          })
        },
      })

      const link = document.createElement('a')
      link.download = buildExportFileName(fileName)
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      className="report-btn report-btn--secondary"
      data-export-hide
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? '导出中…' : '导出图片'}
    </button>
  )
}
