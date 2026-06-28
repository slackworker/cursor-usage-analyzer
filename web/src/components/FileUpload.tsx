import { useRef, type ChangeEvent } from 'react'
import { useCsvFileDrop } from '../hooks/useCsvFileDrop'
import './FileUpload.css'

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
        <div className="file-upload__icon" aria-hidden>
          ↑
        </div>
        <p className="file-upload__prompt">拖放 CSV 到此处，或点击选择文件</p>
        <p className="file-upload__hint">文件仅在浏览器本地解析，不会上传到服务器</p>
      </div>
      {error ? <p className="file-upload__error">{error}</p> : null}
    </div>
  )
}
