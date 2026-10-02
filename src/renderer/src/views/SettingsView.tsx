import { useAppStore } from '../store'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function SettingsView() {
  const snap = useAppStore((s) => s.snap)!
  const runBusy = useAppStore((s) => s.runBusy)
  const localBusy = useAppStore((s) => s.localBusy)
  const busy = localBusy || !!snap.isBusy

  return (
    <div className="stagger" style={{ height: '100%', overflow: 'auto', padding: 28 }}>
      <div style={{ maxWidth: 560, display: 'grid', gap: 20 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              letterSpacing: '-0.03em',
              fontWeight: 700
            }}
          >
            Setting
          </h1>
          <p style={{ color: 'var(--muted)', margin: '8px 0 0', fontSize: 14, lineHeight: 1.45 }}>
            导入导出 Profile、打开配置目录，以及开机启动等偏好。
          </p>
        </div>

        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>
            数据
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <Button
              variant="ghost"
              style={{ justifyContent: 'flex-start' }}
              disabled={busy}
              onClick={() => void runBusy(() => window.apiswitch.exportProfiles(true))}
            >
              导出（脱敏）
            </Button>
            <Button
              variant="ghost"
              style={{ justifyContent: 'flex-start' }}
              disabled={busy}
              onClick={() => void runBusy(() => window.apiswitch.importProfiles(false))}
            >
              导入合并
            </Button>
            <Button
              variant="ghost"
              style={{ justifyContent: 'flex-start' }}
              disabled={busy}
              onClick={() => void runBusy(() => window.apiswitch.openConfigDir())}
            >
              打开配置目录
            </Button>
          </div>
        </Card>

        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 14 }}>
            启动
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 14,
              cursor: busy ? 'not-allowed' : 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={snap.openAtLogin}
              disabled={busy}
              onChange={(e) =>
                void runBusy(() => window.apiswitch.setOpenAtLogin(e.target.checked))
              }
            />
            登录时启动
          </label>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '10px 0 0', lineHeight: 1.4 }}>
            开启后随系统登录自动启动 ApiSwitch（托盘驻留）。
          </p>
        </Card>

        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>
            关于
          </div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>
            ApiSwitch · v1.0.1
          </div>
        </Card>
      </div>
    </div>
  )
}
