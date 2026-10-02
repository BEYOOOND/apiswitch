import { ipcMain, dialog, clipboard, shell, app, BrowserWindow } from 'electron'
import { writeFileSync, readFileSync } from 'fs'
import type { AppController } from './app-controller'
import type { Profile, SkillRecord, SwitchPhase } from './core'
import { quitApp } from './quit'

export interface IpcHost {
  getWindow: () => BrowserWindow | null
  showMainWindow: () => void
  refreshTray: () => void
}

export function registerIpc(controller: AppController, host: IpcHost): void {
  const notify = () => host.refreshTray()

  const emitProgress = (phase: SwitchPhase | string, message?: string) => {
    const win = host.getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('apiswitch:switch-progress', { phase, message })
    }
  }

  const emitState = () => {
    const win = host.getWindow()
    if (win && !win.isDestroyed()) {
      const snap = controller.getSnapshot()
      snap.openAtLogin = app.getLoginItemSettings().openAtLogin
      win.webContents.send('apiswitch:state', snap)
    }
  }

  const withOpenAtLogin = () => {
    const snap = controller.getSnapshot()
    snap.openAtLogin = app.getLoginItemSettings().openAtLogin
    return snap
  }

  ipcMain.handle('apiswitch:getState', () => withOpenAtLogin())

  ipcMain.handle('apiswitch:reload', async () => {
    controller.reload()
    notify()
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:reloadCatalog', async () => {
    await controller.ensureCatalog()
    controller.reloadCatalog()
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:activate', async (_e, id: string) => {
    await controller.activate(id, emitProgress)
    notify()
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:activateLastRelay', async () => {
    await controller.activateLastRelay(emitProgress)
    notify()
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:restoreOfficial', async () => {
    await controller.restoreOfficial(emitProgress)
    notify()
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:restoreTargets', async (_e, targets: string[]) => {
    await controller.restoreTargets(targets, emitProgress)
    notify()
    return withOpenAtLogin()
  })

  ipcMain.handle(
    'apiswitch:upsert',
    async (_e, profile: Profile, activate: boolean) => {
      await controller.upsert(profile, activate, emitProgress)
      notify()
      return withOpenAtLogin()
    }
  )

  ipcMain.handle(
    'apiswitch:delete',
    async (_e, id: string, restoreIfActive: boolean) => {
      await controller.delete(id, restoreIfActive)
      notify()
      return withOpenAtLogin()
    }
  )

  ipcMain.handle('apiswitch:duplicate', async (_e, id: string) => {
    controller.duplicate(id)
    notify()
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:test', async (_e, profile: Profile) => {
    await controller.test(profile, () => {
      emitState()
    })
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:fetchModels', async (_e, profile: Profile) => {
    const models = await controller.fetchModels(profile)
    return { models, snap: withOpenAtLogin() }
  })

  ipcMain.handle('apiswitch:exportProfiles', async (_e, redactSecrets: boolean) => {
    const win = host.getWindow()
    const data = controller.exportJSON(redactSecrets)
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      defaultPath: redactSecrets
        ? 'apiswitch-profiles-redacted.json'
        : 'apiswitch-profiles.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return withOpenAtLogin()
    writeFileSync(filePath, data)
    controller.statusMessage = 'Exported'
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:importProfiles', async (_e, replace: boolean) => {
    const win = host.getWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePaths[0]) return withOpenAtLogin()
    const raw = readFileSync(filePaths[0])
    controller.importJSON(raw, replace)
    notify()
    return withOpenAtLogin()
  })

  ipcMain.handle(
    'apiswitch:installSkill',
    async (_e, mirrorTo: string[], overwrite: boolean) => {
      const win = host.getWindow()
      const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        message: 'Select a skill folder containing SKILL.md'
      })
      if (canceled || !filePaths[0]) return withOpenAtLogin()
      controller.installSkillFrom(filePaths[0], mirrorTo, overwrite)
      return withOpenAtLogin()
    }
  )

  ipcMain.handle(
    'apiswitch:syncSkill',
    (_e, record: SkillRecord, toolIds: string[], overwrite: boolean) => {
      controller.syncSkill(record, toolIds, overwrite)
      return withOpenAtLogin()
    }
  )

  ipcMain.handle(
    'apiswitch:promoteSkill',
    (_e, record: SkillRecord, mirrorTo: string[], overwrite: boolean) => {
      controller.promoteSkill(record, mirrorTo, overwrite)
      return withOpenAtLogin()
    }
  )

  ipcMain.handle('apiswitch:deleteSkill', (_e, record: SkillRecord) => {
    controller.deleteSkill(record)
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:copyActiveKey', () => {
    const key = controller.copyActiveKey()
    if (key) clipboard.writeText(key)
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:openConfigDir', () => {
    const dir = controller.openConfigDir()
    void shell.openPath(dir)
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:openPath', (_e, p: string) => {
    void shell.openPath(p)
  })

  ipcMain.handle('apiswitch:newBlankProfile', () => controller.newBlankProfile())

  ipcMain.handle('apiswitch:setOpenAtLogin', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
    return withOpenAtLogin()
  })

  ipcMain.handle('apiswitch:showMainWindow', () => {
    host.showMainWindow()
  })

  ipcMain.handle('apiswitch:quit', () => {
    quitApp()
  })

  ipcMain.handle('apiswitch:clearStatus', () => {
    controller.statusMessage = ''
    controller.errorMessage = null
    return withOpenAtLogin()
  })
}
