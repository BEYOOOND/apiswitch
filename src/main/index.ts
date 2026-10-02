import { app, BrowserWindow, Tray } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { createTray, refreshTray } from './tray'
import { AppController } from './app-controller'
import { isQuitting } from './quit'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
export const controller = new AppController()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    registerIpc(controller, {
      getWindow: () => mainWindow,
      showMainWindow,
      refreshTray: () => refreshTray(tray, controller, { showMainWindow })
    })
    createWindow()
    tray = createTray(controller, { showMainWindow })

    app.on('activate', () => {
      showMainWindow()
    })
  })
}

app.on('window-all-closed', () => {
  /* keep running in tray */
})

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: 'ApiSwitch',
    backgroundColor: '#F5F5F7',
    show: false,
    // macOS: hiddenInset + traffic lights; Windows: hidden + caption overlay
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac
      ? {
          trafficLightPosition: { x: 16, y: 14 }
        }
      : {
          titleBarOverlay: {
            color: '#F5F5F7',
            symbolColor: '#1D1D1F',
            height: 44
          }
        }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting()) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}
