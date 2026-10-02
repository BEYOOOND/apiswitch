import { Tray, Menu, nativeImage, app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import type { AppController } from './app-controller'
import { quitApp } from './quit'

function resolveTrayIcon(): Electron.NativeImage {
  const isMac = process.platform === 'darwin'
  // mac: black template 16px. win: filled dark glyph (readable on light/dark taskbars).
  const candidates = isMac
    ? [
        join(process.resourcesPath || '', 'tray-16.png'),
        join(__dirname, '../../resources/tray-16.png'),
        join(app.getAppPath(), 'resources/tray-16.png'),
        join(process.resourcesPath || '', 'tray-32.png'),
        join(__dirname, '../../resources/tray-32.png')
      ]
    : [
        join(process.resourcesPath || '', 'tray-16-win.png'),
        join(process.resourcesPath || '', 'tray-16.png'),
        join(__dirname, '../../resources/tray-16-win.png'),
        join(__dirname, '../../resources/tray-16.png'),
        join(process.resourcesPath || '', 'tray-32-win.png'),
        join(process.resourcesPath || '', 'tray-32.png'),
        join(__dirname, '../../resources/tray-32-win.png'),
        join(app.getAppPath(), 'resources/tray-16-win.png')
      ]

  for (const p of candidates) {
    if (!p || !existsSync(p)) continue
    let img = nativeImage.createFromPath(p)
    if (img.isEmpty()) continue
    if (isMac) {
      const size = img.getSize()
      if (size.width > 16 || size.height > 16) {
        img = img.resize({ width: 16, height: 16, quality: 'best' })
      }
      img.setTemplateImage(true)
    }
    return img
  }

  const fallback = drawFallbackIcon()
  if (isMac) fallback.setTemplateImage(true)
  return fallback
}

/** Circle + simple “A” — matches packaged tray assets. */
function drawFallbackIcon(): Electron.NativeImage {
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  const set = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = a
  }
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const rad = size / 2 - 0.8
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= rad * rad) set(x, y, 29, 29, 31, 255)
    }
  }
  // White A (pixel strokes)
  const white = (x: number, y: number) => set(x, y, 255, 255, 255, 255)
  // left leg
  for (let y = 3; y <= 12; y++) {
    const t = (y - 3) / 9
    white(Math.round(7.5 - t * 3.5), y)
    white(Math.round(7.5 - t * 3.5) + 1, y)
  }
  // right leg
  for (let y = 3; y <= 12; y++) {
    const t = (y - 3) / 9
    white(Math.round(7.5 + t * 3.5), y)
    white(Math.round(7.5 + t * 3.5) - 1, y)
  }
  // crossbar
  for (let x = 5; x <= 10; x++) {
    white(x, 8)
    white(x, 9)
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}

export function createTray(
  controller: AppController,
  opts: { showMainWindow: () => void }
): Tray {
  const tray = new Tray(resolveTrayIcon())
  tray.setToolTip('ApiSwitch')
  refreshTray(tray, controller, opts)
  return tray
}

export function refreshTray(
  tray: Tray | null,
  controller: AppController,
  opts?: { showMainWindow: () => void }
): void {
  if (!tray) return
  const data = controller.data
  const profiles = data.profiles

  const profileItems = profiles.map((p) => ({
    label: (data.active === p.id ? '● ' : '○ ') + p.name,
    click: () => {
      void (async () => {
        try {
          await controller.activate(p.id)
          refreshTray(tray, controller, opts)
        } catch {
          /* status on next poll */
        }
      })()
    }
  }))

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: controller.menuTitle, enabled: false },
    { type: 'separator' },
    {
      label: 'Codex 回官方',
      click: () => {
        void (async () => {
          try {
            await controller.restoreOfficial()
            refreshTray(tray, controller, opts)
          } catch {
            /* */
          }
        })()
      }
    },
    {
      label: '切回上次中转',
      enabled: controller.canActivateLastRelay,
      click: () => {
        void (async () => {
          try {
            await controller.activateLastRelay()
            refreshTray(tray, controller, opts)
          } catch {
            /* */
          }
        })()
      }
    },
    { type: 'separator' },
    ...profileItems,
    { type: 'separator' },
    {
      label: '测试当前中转',
      enabled: !!data.active,
      click: async () => {
        const p = data.profiles.find((x) => x.id === data.active)
        if (p) await controller.test(p)
      }
    },
    {
      label: '打开主窗口',
      click: () => opts?.showMainWindow()
    },
    { type: 'separator' },
    {
      label: '退出 ApiSwitch',
      click: () => quitApp()
    }
  ]

  tray.setContextMenu(Menu.buildFromTemplate(template))
  tray.setToolTip(controller.menuTitle)
}
