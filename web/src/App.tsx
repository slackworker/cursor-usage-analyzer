import { CodeStyleTitle } from './components/CodeStyleTitle'
import { FileUpload } from './components/FileUpload'
import { useReport } from './hooks/useReport'
import { ReportPage } from './pages/ReportPage'
import './styles/theme.css'
import './styles/report.css'

const CURSOR_USAGE_URL = 'https://cursor.com/dashboard/USAGE'
const GITHUB_REPO_URL = 'https://github.com/slackworker/cursor-usage-analyzer'

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
        <header className="upload-landing__hero">
          <CodeStyleTitle className="code-style-title code-style-title--landing" cursor="blink" />
        </header>
        <section className="upload-landing__action" aria-label="上传 CSV">
          <p className="upload-landing__guide">
            在{' '}
            <a
              className="upload-landing__link"
              href={CURSOR_USAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Cursor Usage
            </a>
            {' '}页点击 <ExportCsvBadge /> 导出用量 CSV
          </p>
          <FileUpload onFileSelect={setCsvFile} />
        </section>
        <footer className="upload-landing__footer">
          文件仅在浏览器本地解析 ·{' '}
          <a
            className="upload-landing__link"
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub 开源
          </a>
        </footer>
      </div>
    )
  }

  return <ReportPage />
}

export default App
