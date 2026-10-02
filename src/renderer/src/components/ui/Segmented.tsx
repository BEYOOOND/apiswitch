export function Segmented<T extends string>({
  items,
  value,
  onChange
}: {
  items: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div
      className="titlebar-no-drag"
      style={{
        display: 'inline-flex',
        padding: 3,
        gap: 2,
        background: 'var(--bg-soft)',
        borderRadius: 'var(--r-pill)',
        border: '1px solid var(--line)'
      }}
    >
      {items.map((item) => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              border: 'none',
              background: active ? 'var(--bg-elevated)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--muted)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              borderRadius: 'var(--r-pill)',
              padding: '5px 12px',
              fontSize: 12.5,
              fontWeight: active ? 600 : 500,
              transition: 'all 0.18s ease-out'
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
