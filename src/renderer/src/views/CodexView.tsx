import { useAppStore } from '../store'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function CodexView() {
  const snap = useAppStore((s) => s.snap)!
  const selectedId = useAppStore((s) => s.selectedId)
  const select = useAppStore((s) => s.select)
  const openEditor = useAppStore((s) => s.openEditor)
  const setConfirm = useAppStore((s) => s.setConfirm)
  const runBusy = useAppStore((s) => s.runBusy)
  const localBusy = useAppStore((s) => s.localBusy)

  const selected = snap.data.profiles.find((p) => p.id === selectedId) ?? null
  const busy = localBusy || !!snap.isBusy

  return (
    <div
      className="stagger"
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        minHeight: 0,
        gap: 0
      }}
    >
      <aside
        style={{
          borderRight: '1px solid var(--line)',
          background: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: '12px 10px'
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Button
            variant="primary"
            onClick={async () => {
              const blank = await window.apiswitch.newBlankProfile()
              openEditor(blank)
            }}
          >
            新建
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirm({ kind: 'restoreOfficial' })}
          >
            Codex 回官方
          </Button>
          <Button
            variant="ghost"
            disabled={!snap.canActivateLastRelay || busy}
            onClick={() => void runBusy(() => window.apiswitch.activateLastRelay())}
          >
            切回上次
          </Button>
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10, padding: '0 4px' }}>
          {snap.statusLine}
        </div>

        <div
          style={{
            overflow: 'auto',
            flex: 1,
            display: 'grid',
            gap: 10,
            alignContent: 'start',
            // Padding so selection ring / rounded borders are not clipped
            padding: '4px 6px 8px'
          }}
        >
          {snap.data.profiles.length === 0 && (
            <Card style={{ padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>还没有 Profile</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                点击「新建」添加中转站。
              </div>
            </Card>
          )}
          {snap.data.profiles.map((p) => {
            const active = Object.values(snap.data.activeByTarget).includes(p.id)
            const sel = selectedId === p.id
            return (
              <Card key={p.id} active={sel} onClick={() => select(p.id)} style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 14, letterSpacing: '-0.02em' }}>{p.name}</strong>
                  {active && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#fff',
                        background: 'var(--ok)',
                        borderRadius: 'var(--r-pill)',
                        padding: '2px 8px',
                        boxShadow: '0 0 0 3px var(--ok-soft)'
                      }}
                    >
                      ON
                    </span>
                  )}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginTop: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {p.baseURL || '(no url)'}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}
                >
                  {p.codex.model || 'codex'}
                </div>
              </Card>
            )
          })}
        </div>
      </aside>

      <section style={{ overflow: 'auto', padding: 28, minHeight: 0 }}>
        {!selected ? (
          <Empty />
        ) : (
          <div style={{ maxWidth: 680, display: 'grid', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 32,
                    letterSpacing: '-0.04em',
                    fontWeight: 700
                  }}
                >
                  {selected.name}
                </h1>
                <span className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {selected.id}
                </span>
              </div>
              <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>
                写入目标：Codex
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {snap.data.activeByTarget.codex === selected.id && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 'var(--r-pill)',
                      padding: '3px 9px',
                      color: '#fff',
                      background: 'var(--ok)',
                      boxShadow: '0 0 0 3px var(--ok-soft)'
                    }}
                  >
                    Codex · ON
                  </span>
                )}
              </div>
            </div>

            <Card style={{ padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 12 }}>
                连接
              </div>
              <Row label="Base URL" value={selected.baseURL || '—'} mono />
              <Row label="Model" value={selected.codex.model || '（默认）'} mono />
              <Row
                label="API Key"
                value={
                  selected.apiKey ? mask(selected.apiKey) : selected.apiKeyRef || '—'
                }
                mono
              />
            </Card>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Button
                variant="primary"
                lit={isFullyActive(selected, snap.data.activeByTarget)}
                busy={busy}
                disabled={busy || isFullyActive(selected, snap.data.activeByTarget)}
                onClick={() =>
                  void runBusy(() => window.apiswitch.activate(selected.id), {
                    optimisticActive: selected.id
                  })
                }
              >
                {isFullyActive(selected, snap.data.activeByTarget)
                  ? '● 已写入'
                  : '启用此中转'}
              </Button>
              <Button onClick={() => openEditor(selected)}>编辑</Button>
              <Button
                disabled={snap.isProbing || busy}
                onClick={() => void runBusy(() => window.apiswitch.test(selected))}
              >
                测试连接
              </Button>
              <Button
                variant="ghost"
                onClick={() => void runBusy(() => window.apiswitch.duplicate(selected.id))}
              >
                复制
              </Button>
              <Button
                variant="ghost"
                onClick={() => void runBusy(() => window.apiswitch.copyActiveKey())}
              >
                复制当前 Key
              </Button>
              <Button
                variant="danger"
                onClick={() => setConfirm({ kind: 'deleteProfile', payload: selected.id })}
              >
                删除
              </Button>
              <Button variant="ghost" onClick={() => setConfirm({ kind: 'clearTools' })}>
                清除工具配置…
              </Button>
            </div>

            {(snap.isProbing || snap.probeText) && (
              <Card style={{ padding: 16 }}>
                {snap.isProbing && (
                  <div className="probe-progress" style={{ marginBottom: 12 }}>
                    <span />
                  </div>
                )}
                <pre
                  className="mono"
                  style={{
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    fontSize: 12,
                    color: snap.lastProbe?.ok
                      ? 'var(--ok)'
                      : snap.lastProbe
                        ? 'var(--danger)'
                        : 'var(--muted)'
                  }}
                >
                  {snap.probeText}
                </pre>
              </Card>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function Empty() {
  return (
    <div style={{ paddingTop: 48, maxWidth: 420 }}>
      <h2
        style={{
          color: 'var(--text)',
          marginTop: 0,
          fontSize: 28,
          letterSpacing: '-0.04em',
          fontWeight: 700
        }}
      >
        选择或新建中转
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.5 }}>
        一键写入 Codex 中转。关闭窗口后仍驻留系统托盘。
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  mono
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr',
        gap: 12,
        marginBottom: 10
      }}
    >
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
      <span
        className={mono ? 'mono' : undefined}
        style={{ fontSize: 13, wordBreak: 'break-all' }}
      >
        {value}
      </span>
    </div>
  )
}

function mask(key: string): string {
  if (key.length <= 8) return '*'.repeat(key.length)
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}

function isFullyActive(
  profile: { id: string },
  activeByTarget: Record<string, string>
): boolean {
  return activeByTarget.codex === profile.id
}
