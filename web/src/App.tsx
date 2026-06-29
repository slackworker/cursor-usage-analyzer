import { CodeStyleTitle } from './components/CodeStyleTitle'
import { FileUpload } from './components/FileUpload'
import { useReport } from './hooks/useReport'
import { ReportPage } from './pages/ReportPage'
import './styles/theme.css'
import './styles/report.css'

function ExportCsvBadge() {
  return (
    <span className="upload-landing__export-csv" aria-hidden>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export CSV
    </span>
  )
}

function App() {
  const { hasData, setCsvFile } = useReport()

  if (!hasData) {
    return (
      <div className="upload-landing">
        <div className="upload-landing__inner">
          <CodeStyleTitle className="code-style-title code-style-title--landing" cursor="blink" />
          <p className="upload-landing__subtitle">
            请先在{' '}
            <a
              className="upload-landing__link"
              href="https://cursor.com/dashboard/USAGE"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cursor Usage页
            </a>
            {' '}点击 <ExportCsvBadge /> 导出文件，再上传至此处；报告仅在浏览器本地生成。
          </p>
          <FileUpload onFileSelect={setCsvFile} />
        </div>
      </div>
    )
  }

  return <ReportPage />
}

export default App
