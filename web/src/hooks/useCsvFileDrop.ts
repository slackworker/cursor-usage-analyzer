import { useCallback, useRef, useState, type DragEvent } from 'react'

function isCsvFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.csv') ||
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel'
  )
}

export function useCsvFileDrop(
  onFileSelect: (file: File) => void | Promise<void>,
  disabled = false,
) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragCounter = useRef(0)

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return

      if (!isCsvFile(file)) {
        setError('请选择 CSV 文件')
        return
      }

      setError(null)
      await onFileSelect(file)
    },
    [disabled, onFileSelect],
  )

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (disabled) return
    dragCounter.current += 1
    setIsDragging(true)
  }

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
  }

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (disabled) return
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    void handleFile(event.dataTransfer.files?.[0])
  }

  const dropTargetProps = {
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  }

  return { isDragging, error, dropTargetProps, handleFile, setError }
}
