import type { ReactNode } from 'react'

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgba(0,0,0,0.28)',
        display: 'flex',
        justifyContent: 'flex-end',
        backdropFilter: 'blur(6px)'
      }}
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '100%',
          height: '100%',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--line)',
          borderRadius: 'var(--r-lg) 0 0 var(--r-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sheetIn 0.22s ease-out'
        }}
      >
        <header
          style={{
            padding: '28px 24px 12px',
            borderBottom: '1px solid var(--line)'
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.03em', fontWeight: 700 }}>
            {title}
          </h2>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>{children}</div>
        {footer && (
          <footer
            style={{
              padding: 20,
              borderTop: '1px solid var(--line)',
              display: 'flex',
              gap: 8
            }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>
  )
}
