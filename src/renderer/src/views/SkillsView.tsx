import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { inputStyle } from '../components/ui/Field'

export function SkillsView() {
  const snap = useAppStore((s) => s.snap)!
  const applySnap = useAppStore((s) => s.applySnap)
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'all' | 'user' | 'native' | 'system'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mirror, setMirror] = useState<string[]>(['codex', 'cursor'])
  const [overwrite, setOverwrite] = useState(false)
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

  const filtered = useMemo(() => {
    return snap.skills.filter((s) => {
      if (scope !== 'all' && s.scope !== scope) return false
      if (!q.trim()) return true
      const hay = `${s.name} ${s.summary} ${s.category} ${s.relativePath}`.toLowerCase()
      return hay.includes(q.trim().toLowerCase())
    })
  }, [snap.skills, q, scope])

  const selected = snap.skills.find((s) => s.id === selectedId) ?? filtered[0] ?? null

  const run = async (fn: () => Promise<unknown>) => {
    applySnap((await fn()) as Parameters<typeof applySnap>[0])
  }

  const toggleMirror = (id: string) => {
    setMirror((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div
      className="stagger"
      style={{ height: '100%', display: 'grid', gridTemplateColumns: '340px 1fr', minHeight: 0 }}
    >
      <aside
        style={{
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: '16px 12px'
        }}
      >
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索 skills…"
            style={inputStyle}
          />
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
            style={inputStyle}
          >
            <option value="all">全部 scope</option>
            <option value="user">user</option>
            <option value="native">native</option>
            <option value="system">system</option>
          </select>
          <Button
            onClick={() => {
              setLoading(true)
              void run(() => window.apiswitch.reloadCatalog()).finally(() => setLoading(false))
            }}
          >
            刷新扫描
          </Button>
          <Button
            variant="primary"
            onClick={() => void run(() => window.apiswitch.installSkill(mirror, overwrite))}
          >
            安装 Skill…
          </Button>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: 12,
              color: 'var(--muted)',
              padding: '4px 2px'
            }}
          >
            {snap.mirrorTargets.map((t) => (
              <label key={t.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={mirror.includes(t.id)}
                  onChange={() => toggleMirror(t.id)}
                />
                {t.displayName}
              </label>
            ))}
            <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              覆盖
            </label>
          </div>
        </div>

        <div style={{ overflow: 'auto', flex: 1, display: 'grid', gap: 8, alignContent: 'start' }}>
          {loading && (
            <>
              <div className="skeleton" style={{ height: 56 }} />
              <div className="skeleton" style={{ height: 56 }} />
              <div className="skeleton" style={{ height: 56 }} />
            </>
          )}
          {!loading &&
            filtered.map((s) => (
              <Card
                key={s.id}
                active={selected?.id === s.id}
                onClick={() => setSelectedId(s.id)}
                style={{ padding: 12 }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {s.category} · {s.scope}
                </div>
              </Card>
            ))}
          {!loading && !filtered.length && (
            <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>无匹配 Skills</div>
          )}
        </div>
      </aside>

      <section style={{ overflow: 'auto', padding: 28 }}>
        {!selected ? (
          <p style={{ color: 'var(--muted)' }}>扫描本地 skills 目录。</p>
        ) : (
          <div style={{ maxWidth: 680, display: 'grid', gap: 16 }}>
            <div>
              <h1
                style={{
                  margin: '0 0 8px',
                  letterSpacing: '-0.04em',
                  fontSize: 28,
                  fontWeight: 700
                }}
              >
                {selected.name}
              </h1>
              <p style={{ color: 'var(--muted)', margin: 0 }}>{selected.summary}</p>
            </div>
            <Card>
              <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                {selected.directory}
              </div>
            </Card>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={() => void window.apiswitch.openPath(selected.directory)}>
                打开文件夹
              </Button>
              <Button
                onClick={() =>
                  void run(() => window.apiswitch.syncSkill(selected, mirror, overwrite))
                }
              >
                镜像到工具
              </Button>
              {!selected.isInSharedLayer && (
                <Button
                  onClick={() =>
                    void run(() =>
                      window.apiswitch.promoteSkill(selected, mirror, overwrite)
                    )
                  }
                >
                  提升到 shared
                </Button>
              )}
              {selected.canDelete && (
                <Button
                  variant="danger"
                  onClick={() => void run(() => window.apiswitch.deleteSkill(selected))}
                >
                  删除
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
