import { FileUpload } from './components/FileUpload'
import { useReport } from './hooks/useReport'
import { ReportPage } from './pages/ReportPage'
import './styles/theme.css'
import './styles/report.css'

function App() {
  const { hasData, setCsvFile } = useReport()

  if (!hasData) {
    return (
      <div className="upload-landing">
        <div className="upload-landing__inner">
          <h1 className="upload-landing__title">Cursor Usage 分析报告</h1>
          <p className="upload-landing__subtitle">
            上传 Cursor Dashboard 导出的用量 CSV，在浏览器本地生成可视化报告。
          </p>
          <FileUpload onFileSelect={setCsvFile} />
        </div>
      </div>
    )
  }

  return <ReportPage />
}

export default App
