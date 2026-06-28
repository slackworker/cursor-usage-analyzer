import { useRef, type ChangeEvent } from 'react'
import { useCsvFileDrop } from '../hooks/useCsvFileDrop'
import './FileUpload.css'

const glyphProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true as const,
}

function FileGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} {...glyphProps}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.484-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  )
}

function ArrowRightGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} {...glyphProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}

function ReleaseDropGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} {...glyphProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v8.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.25L12 12l3.75-3.75" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 2"
        d="M5.25 16.5h13.5a1.5 1.5 0 011.5 1.5v1.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-1.5a1.5 1.5 0 011.5-1.5z"
      />
    </svg>
  )
}

function UploadFlowIcon({ isDragging }: { isDragging: boolean }) {
  return (
    <div
      className={`file-upload__icon-flow${isDragging ? ' file-upload__icon-flow--active' : ''}`}
      aria-hidden
    >
      <FileGlyph className="file-upload__glyph file-upload__glyph--file" />
      <ArrowRightGlyph className="file-upload__glyph file-upload__glyph--arrow" />
      <ReleaseDropGlyph className="file-upload__glyph file-upload__glyph--release" />
    </div>
  )
}

interface FileUploadProps {
  onFileSelect: (file: File) => void | Promise<void>
  accept?: string
  disabled?: boolean
}

export function FileUpload({
  onFileSelect,
  accept = '.csv,text/csv',
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { isDragging, error, dropTargetProps, handleFile } = useCsvFileDrop(onFileSelect, disabled)

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  return (
    <div className="file-upload">
      <div
        className={`file-upload__dropzone${isDragging ? ' file-upload__dropzone--active' : ''}${disabled ? ' file-upload__dropzone--disabled' : ''}`}
        {...dropTargetProps}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="上传 Cursor 用量 CSV 文件"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="file-upload__input"
          onChange={onInputChange}
          disabled={disabled}
          aria-hidden
        />
        <UploadFlowIcon isDragging={isDragging} />
        <p className="file-upload__prompt">拖放 CSV 到此处，或点击选择文件</p>
        <p className="file-upload__hint">文件仅在浏览器本地解析，不会上传到服务器</p>
      </div>
      {error ? <p className="file-upload__error">{error}</p> : null}
    </div>
  )
}
