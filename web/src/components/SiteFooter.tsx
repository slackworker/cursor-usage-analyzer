import { GITHUB_REPO_URL } from '../lib/constants'

interface SiteFooterProps {
  variant?: 'landing' | 'report'
}

export function SiteFooter({ variant = 'report' }: SiteFooterProps) {
  return (
    <footer className={`site-footer site-footer--${variant}`} data-export-hide>
      文件仅在浏览器本地解析 ·{' '}
      <a
        className="site-footer__link"
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
      </a>
    </footer>
  )
}
