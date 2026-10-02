import type { ReactNode } from 'react'
import { useAppStore, type Section } from '../store'
import { useWindowControlsInset } from '../hooks/useWindowControlsInset'
import { Segmented } from './ui/Segmented'
import { StatusPill } from './ui/StatusPill'

const nav: { id: Section; label: string }[] = [
  { id: 'codex', label: 'API' },
  { id: 'skills', label: 'Skills' },
  { id: 'agents', label: 'Agents' },
  { id: 'settings', label: 'Setting' }
]

const phaseLabel: Record<string, string> = {
  preparing: '准备中',
  writing: '写入配置',
  env: '更新环境',
  done: '完成',
  error: '失败'
}

export function Shell({ children }: { children: ReactNode }) {
  const section = useAppStore((s) => s.section)
  const setSection = useAppStore((s) => s.setSection)
  const snap = useAppStore((s) => s.snap)!
  const localBusy = useAppStore((s) => s.localBusy)
  const progressPhase = useAppStore((s) => s.progressPhase)
  const applySnap = useAppStore((s) => s.applySnap)
  const { left, right, isMac } = useWindowControlsInset(146)

  const clearStatus = async () => {
    applySnap(await window.apiswitch.clearStatus())
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        position: 'relative',
        background: 'var(--bg)'
      }}
    >
      {(localBusy || snap.isBusy || snap.isProbing) && (
        <div className="busy-bar">
          <span />
        </div>
      )}

      <header
        className="titlebar-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingLeft: left,
          paddingRight: right,
          height: 'var(--titlebar-h)',
          borderBottom: '1px solid var(--line)',
          background: isMac ? 'rgba(246,246,248,0.82)' : 'rgba(245,245,247,0.92)',
          backdropFilter: 'blur(20px) saturate(180%)'
        }}
      >
        <div style={{ minWidth: 0, flexShrink: 0, paddingRight: 4 }}>
          <div
            style={{
              fontSize: isMac ? 13 : 18,
              fontWeight: isMac ? 600 : 700,
              letterSpacing: isMac ? '-0.01em' : '-0.04em',
              lineHeight: 1.15
            }}
          >
            ApiSwitch
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--muted)',
              marginTop: isMac ? 1 : 3,
              opacity: 0.85
            }}
          >
            {isMac ? 'macOS' : 'Windows'} · v1.0.1
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <Segmented
            items={nav}
            value={section}
            onChange={(id) => {
              setSection(id)
              if (id === 'skills' || id === 'agents') {
                void window.apiswitch.reloadCatalog().then((s) => applySnap(s))
              }
            }}
          />
        </div>

        <div
          className="titlebar-no-drag"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            maxWidth: '40%',
            justifyContent: 'flex-end'
          }}
        >
          {(localBusy || snap.isBusy) && progressPhase && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              {phaseLabel[progressPhase] || progressPhase}
            </span>
          )}
          <StatusPill active={!!snap.data.active} label={snap.menuTitle} />
        </div>
      </header>

      <main style={{ overflow: 'hidden', minHeight: 0 }}>{children}</main>

      {(snap.statusMessage || snap.errorMessage) && (
        <footer
          className="titlebar-no-drag"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: isMac ? '10px 16px' : '12px 20px',
            borderTop: '1px solid var(--line)',
            background: snap.errorMessage ? 'var(--danger-soft)' : 'var(--bg-elevated)'
          }}
        >
          <span style={{ flex: 1, fontSize: 13 }}>
            {snap.errorMessage || snap.statusMessage}
          </span>
          <button
            onClick={() => void clearStatus()}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            关闭
          </button>
        </footer>
      )}
    </div>
  )
}
