import { useEffect } from 'react'
import { useAppStore } from './store'
import { Shell } from './components/Shell'
import { CodexView } from './views/CodexView'
import { SkillsView } from './views/SkillsView'
import { AgentsView } from './views/AgentsView'
import { SettingsView } from './views/SettingsView'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ProfileDrawer } from './components/ProfileDrawer'

export default function App() {
  const section = useAppStore((s) => s.section)
  const refresh = useAppStore((s) => s.refresh)
  const applySnap = useAppStore((s) => s.applySnap)
  const setProgressPhase = useAppStore((s) => s.setProgressPhase)
  const setLocalBusy = useAppStore((s) => s.setLocalBusy)
  const snap = useAppStore((s) => s.snap)

  useEffect(() => {
    void refresh()
    const unsubProgress = window.apiswitch.onProgress((p) => {
      setProgressPhase(p.phase)
      if (p.phase === 'done' || p.phase === 'error') {
        setLocalBusy(p.phase !== 'done')
      } else {
        setLocalBusy(true)
      }
    })
    const unsubState = window.apiswitch.onState((s) => {
      applySnap(s as Parameters<typeof applySnap>[0])
    })
    const t = setInterval(() => void refresh(), 15000)
    return () => {
      unsubProgress()
      unsubState()
      clearInterval(t)
    }
  }, [refresh, applySnap, setProgressPhase, setLocalBusy])

  if (!snap) {
    return (
      <div
        style={{
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)'
        }}
      >
        <div className="mono" style={{ color: 'var(--muted)', fontSize: 13 }}>
          加载中…
        </div>
      </div>
    )
  }

  return (
    <>
      <Shell>
        {section === 'codex' && <CodexView />}
        {section === 'skills' && <SkillsView />}
        {section === 'agents' && <AgentsView />}
        {section === 'settings' && <SettingsView />}
      </Shell>
      <ProfileDrawer />
      <ConfirmDialog />
    </>
  )
}
