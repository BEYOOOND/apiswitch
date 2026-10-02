import type { CSSProperties, ReactNode } from 'react'

export function Field({
  label,
  children,
  hint
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label
      style={{
        display: 'grid',
        gap: 6,
        marginBottom: 14,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--muted)'
      }}
    >
      {label}
      {children}
      {hint && (
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>{hint}</span>
      )}
    </label>
  )
}

export const inputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-sm)',
  padding: '10px 12px',
  color: 'var(--text)',
  outline: 'none',
  transition: 'border-color 0.15s ease-out'
}
