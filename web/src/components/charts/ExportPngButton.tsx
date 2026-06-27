export function ExportPngButton() {
  const handleExport = () => {
    window.print()
  }

  return (
    <button type="button" className="report-header__action" onClick={handleExport}>
      导出/打印
    </button>
  )
}
