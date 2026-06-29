type CodeStyleTitleProps = {
  className?: string
  cursor?: 'steady' | 'blink'
}

export function CodeStyleTitle({ className, cursor = 'steady' }: CodeStyleTitleProps) {
  return (
    <h1 className={className} aria-label="Cursor Usage 分析">
      <span className="code-style-title__user">cur</span>
      <span className="code-style-title__at" aria-hidden>
        @
      </span>
      <span className="code-style-title__host">SOR</span>
      <span className="code-style-title__colon" aria-hidden>
        :
      </span>
      <span className="code-style-title__path">
        <span className="code-style-title__path-prefix">~/</span>
        <span className="code-style-title__path-label">Usage</span>
      </span>
      <span className="code-style-title__prompt" aria-hidden>
        $
      </span>
      <span className="code-style-title__command">分析</span>
      <span
        className={`code-style-title__cursor code-style-title__cursor--${cursor}`}
        aria-hidden
      />
    </h1>
  )
}
