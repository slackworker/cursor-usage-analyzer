import { CodeStyleTitle } from './components/CodeStyleTitle'
import { FileUpload } from './components/FileUpload'
import { useReport } from './hooks/useReport'
import { ReportPage } from './pages/ReportPage'
import './styles/theme.css'
import './styles/report.css'

const CURSOR_USAGE_URL = 'https://cursor.com/dashboard/USAGE'

function ExportCsvBadge() {
  return (
    <span className="upload-landing__export-csv">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
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
          <p className="upload-landing__tagline">
            本地分析 Cursor 用量，数据不离开你的设备 · 在{' '}
            <a
              className="upload-landing__link"
              href={CURSOR_USAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Cursor Usage
            </a>
            {' '}页点击 <ExportCsvBadge />
          </p>
          <FileUpload onFileSelect={setCsvFile} />
        </div>
      </div>
    )
  }

  return <ReportPage />
}

export default App
