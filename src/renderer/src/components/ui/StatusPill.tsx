export function StatusPill({
  active,
  label
}: {
  active: boolean
  label: string
}) {
  return (
    <div
      className="titlebar-no-drag"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 'var(--r-pill)',
        background: active ? 'var(--accent-soft)' : 'var(--ok-soft)',
        border: '1px solid var(--line)',
        fontSize: 12,
        fontWeight: 600
      }}
    >
      <span
        className={active ? 'status-dot' : undefined}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: active ? 'var(--accent)' : 'var(--ok)',
          display: 'inline-block'
        }}
      />
      <span className="mono" style={{ fontSize: 11 }}>
        {label}
      </span>
    </div>
  )
}
