import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { Card } from '../components/ui/Card'

export function AgentsView() {
  const snap = useAppStore((s) => s.snap)!
  const applySnap = useAppStore((s) => s.applySnap)
  const [loading, setLoading] = useState(!snap.catalogLoaded)

  useEffect(() => {
    if (snap.catalogLoaded) {
      setLoading(false)
      return
    }
    setLoading(true)
    void window.apiswitch.reloadCatalog().then((s) => {
      applySnap(s)
      setLoading(false)
    })
  }, [snap.catalogLoaded, applySnap])

  return (
    <div className="stagger" style={{ height: '100%', overflow: 'auto', padding: 28 }}>
      <h1
        style={{
          marginTop: 0,
          letterSpacing: '-0.04em',
          fontSize: 28,
          fontWeight: 700
        }}
      >
        Agents
      </h1>
      <p style={{ color: 'var(--muted)', maxWidth: 560, marginTop: 0 }}>
        只读清单：发现本机 Codex / Cursor 相关 Agent 资源。
      </p>

      {loading && (
        <div style={{ display: 'grid', gap: 10, maxWidth: 720, marginTop: 20 }}>
          <div className="skeleton" style={{ height: 88 }} />
          <div className="skeleton" style={{ height: 88 }} />
        </div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gap: 10, maxWidth: 720, marginTop: 20 }}>
          {snap.agents.map((a) => (
            <Card key={a.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <strong style={{ letterSpacing: '-0.02em' }}>{a.name}</strong>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    background: 'var(--bg-soft)',
                    borderRadius: 'var(--r-pill)',
                    padding: '2px 8px'
                  }}
                >
                  {a.kind}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{a.detail}</div>
              <button
                className="mono"
                onClick={() => void window.apiswitch.openPath(a.path)}
                style={{
                  marginTop: 12,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: 11,
                  padding: 0,
                  textAlign: 'left',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2
                }}
              >
                {a.path}
              </button>
            </Card>
          ))}
          {!snap.agents.length && (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>未发现 Agent 资源</div>
          )}
        </div>
      )}
    </div>
  )
}
