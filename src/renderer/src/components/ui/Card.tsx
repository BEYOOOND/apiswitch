import type { CSSProperties, ReactNode } from 'react'

export function Card({
  children,
  style,
  active,
  onClick,
  className
}: {
  children: ReactNode
  style?: CSSProperties
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  const interactive = !!onClick
  const Comp = interactive ? 'button' : 'div'
  return (
    <Comp
      className={className}
      onClick={onClick}
      type={interactive ? 'button' : undefined}
      style={{
        background: 'var(--bg-elevated)',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
        borderRadius: 'var(--r-lg)',
        boxShadow: active
          ? '0 0 0 3px var(--accent-soft), var(--shadow-sm)'
          : 'var(--shadow-sm)',
        padding: 16,
        textAlign: 'left',
        width: interactive ? '100%' : undefined,
        transition: 'box-shadow 0.15s ease-out, border-color 0.15s, background 0.15s',
        // No scale — overflow parents clip rounded borders when scaled
        ...style
      }}
    >
      {children}
    </Comp>
  )
}
