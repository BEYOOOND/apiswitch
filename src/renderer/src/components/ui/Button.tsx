import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const styles: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--accent-contrast)',
    border: '1px solid transparent'
  },
  secondary: {
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    border: '1px solid var(--line)',
    boxShadow: 'var(--shadow-sm)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid transparent'
  },
  danger: {
    background: 'var(--danger-soft)',
    color: 'var(--danger)',
    border: '1px solid transparent'
  },
  success: {
    background: 'var(--ok)',
    color: '#fff',
    border: '1px solid transparent',
    boxShadow: '0 0 0 4px var(--ok-soft), 0 4px 14px rgba(52, 199, 89, 0.35)'
  }
}

export function Button({
  children,
  variant = 'secondary',
  busy,
  lit,
  style,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  busy?: boolean
  /** Emphasized “on / active” look */
  lit?: boolean
  children: ReactNode
}) {
  const resolved: Variant = lit ? 'success' : variant
  const isDisabled = disabled || busy
  return (
    <button
      {...rest}
      disabled={isDisabled}
      style={{
        ...styles[resolved],
        borderRadius: 'var(--r-sm)',
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: resolved === 'primary' || resolved === 'success' ? 600 : 500,
        transition:
          'transform 0.15s ease-out, background 0.15s ease-out, box-shadow 0.2s ease-out, opacity 0.15s',
        // Keep “已启用” lit bright even when disabled
        opacity: lit && isDisabled && !busy ? 1 : undefined,
        cursor: lit && isDisabled && !busy ? 'default' : undefined,
        ...style
      }}
    >
      {busy ? '处理中…' : children}
    </button>
  )
}
