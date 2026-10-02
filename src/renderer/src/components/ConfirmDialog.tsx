import { useState } from 'react'
import { useAppStore } from '../store'
import { Button } from './ui/Button'

export function ConfirmDialog() {
  const confirm = useAppStore((s) => s.confirm)
  const setConfirm = useAppStore((s) => s.setConfirm)
  const applySnap = useAppStore((s) => s.applySnap)
  const setLocalBusy = useAppStore((s) => s.setLocalBusy)
  const [busy, setBusy] = useState(false)

  if (!confirm) return null

  const close = () => setConfirm(null)

  const run = async () => {
    setBusy(true)
    setLocalBusy(true)
    try {
      if (confirm.kind === 'restoreOfficial') {
        applySnap(await window.apiswitch.restoreOfficial())
      } else if (confirm.kind === 'deleteProfile') {
        applySnap(await window.apiswitch.delete(String(confirm.payload), true))
      } else if (confirm.kind === 'clearTools') {
        applySnap(await window.apiswitch.restoreTargets(['codex']))
      }
      close()
    } finally {
      setBusy(false)
      setLocalBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.32)',
        display: 'grid',
        placeItems: 'center',
        backdropFilter: 'blur(6px)'
      }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          maxWidth: '92vw',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 22
        }}
      >
        <h3 style={{ marginTop: 0, letterSpacing: '-0.03em', fontSize: 18 }}>
          {confirm.kind === 'restoreOfficial' && 'Codex 回官方？'}
          {confirm.kind === 'deleteProfile' && '删除此 Profile？'}
          {confirm.kind === 'clearTools' && '清除 Codex 中转？'}
        </h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
          {confirm.kind === 'restoreOfficial' &&
            '清除 Codex 中转并尝试恢复 ChatGPT tokens。'}
          {confirm.kind === 'deleteProfile' &&
            '若该 Profile 正在 Codex 上启用，将同时恢复官方登录。'}
          {confirm.kind === 'clearTools' && '清除当前 Codex 中转写入并恢复官方配置。'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={close} disabled={busy}>
            取消
          </Button>
          <Button variant="danger" busy={busy} onClick={() => void run()}>
            确认
          </Button>
        </div>
      </div>
    </div>
  )
}
