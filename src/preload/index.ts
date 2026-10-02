import { contextBridge, ipcRenderer } from 'electron'

export type SwitchProgressPayload = {
  phase: string
  message?: string
}

const api = {
  getState: () => ipcRenderer.invoke('apiswitch:getState'),
  reload: () => ipcRenderer.invoke('apiswitch:reload'),
  reloadCatalog: () => ipcRenderer.invoke('apiswitch:reloadCatalog'),
  activate: (id: string) => ipcRenderer.invoke('apiswitch:activate', id),
  activateLastRelay: () => ipcRenderer.invoke('apiswitch:activateLastRelay'),
  restoreOfficial: () => ipcRenderer.invoke('apiswitch:restoreOfficial'),
  restoreTargets: (targets: string[]) =>
    ipcRenderer.invoke('apiswitch:restoreTargets', targets),
  upsert: (profile: unknown, activate: boolean) =>
    ipcRenderer.invoke('apiswitch:upsert', profile, activate),
  delete: (id: string, restoreIfActive: boolean) =>
    ipcRenderer.invoke('apiswitch:delete', id, restoreIfActive),
  duplicate: (id: string) => ipcRenderer.invoke('apiswitch:duplicate', id),
  test: (profile: unknown) => ipcRenderer.invoke('apiswitch:test', profile),
  fetchModels: (profile: unknown) =>
    ipcRenderer.invoke('apiswitch:fetchModels', profile),
  exportProfiles: (redactSecrets: boolean) =>
    ipcRenderer.invoke('apiswitch:exportProfiles', redactSecrets),
  importProfiles: (replace: boolean) =>
    ipcRenderer.invoke('apiswitch:importProfiles', replace),
  installSkill: (mirrorTo: string[], overwrite: boolean) =>
    ipcRenderer.invoke('apiswitch:installSkill', mirrorTo, overwrite),
  syncSkill: (record: unknown, toolIds: string[], overwrite: boolean) =>
    ipcRenderer.invoke('apiswitch:syncSkill', record, toolIds, overwrite),
  promoteSkill: (record: unknown, mirrorTo: string[], overwrite: boolean) =>
    ipcRenderer.invoke('apiswitch:promoteSkill', record, mirrorTo, overwrite),
  deleteSkill: (record: unknown) =>
    ipcRenderer.invoke('apiswitch:deleteSkill', record),
  copyActiveKey: () => ipcRenderer.invoke('apiswitch:copyActiveKey'),
  openConfigDir: () => ipcRenderer.invoke('apiswitch:openConfigDir'),
  openPath: (p: string) => ipcRenderer.invoke('apiswitch:openPath', p),
  newBlankProfile: () => ipcRenderer.invoke('apiswitch:newBlankProfile'),
  setOpenAtLogin: (enabled: boolean) =>
    ipcRenderer.invoke('apiswitch:setOpenAtLogin', enabled),
  showMainWindow: () => ipcRenderer.invoke('apiswitch:showMainWindow'),
  quit: () => ipcRenderer.invoke('apiswitch:quit'),
  clearStatus: () => ipcRenderer.invoke('apiswitch:clearStatus'),
  onProgress: (cb: (payload: SwitchProgressPayload) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: SwitchProgressPayload) =>
      cb(payload)
    ipcRenderer.on('apiswitch:switch-progress', listener)
    return () => ipcRenderer.removeListener('apiswitch:switch-progress', listener)
  },
  onState: (cb: (snap: unknown) => void) => {
    const listener = (_: Electron.IpcRendererEvent, snap: unknown) => cb(snap)
    ipcRenderer.on('apiswitch:state', listener)
    return () => ipcRenderer.removeListener('apiswitch:state', listener)
  }
}

contextBridge.exposeInMainWorld('apiswitch', api)

export type ApiSwitchAPI = typeof api
