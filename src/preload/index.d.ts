export type SwitchProgressPayload = {
  phase: string
  message?: string
}

export type ApiSwitchAPI = {
  getState: () => Promise<any>
  reload: () => Promise<any>
  reloadCatalog: () => Promise<any>
  activate: (id: string) => Promise<any>
  activateLastRelay: () => Promise<any>
  restoreOfficial: () => Promise<any>
  restoreTargets: (targets: string[]) => Promise<any>
  upsert: (profile: unknown, activate: boolean) => Promise<any>
  delete: (id: string, restoreIfActive: boolean) => Promise<any>
  duplicate: (id: string) => Promise<any>
  test: (profile: unknown) => Promise<any>
  fetchModels: (profile: unknown) => Promise<{ models: { id: string; name: string }[]; snap: any }>
  exportProfiles: (redactSecrets: boolean) => Promise<any>
  importProfiles: (replace: boolean) => Promise<any>
  installSkill: (mirrorTo: string[], overwrite: boolean) => Promise<any>
  syncSkill: (record: unknown, toolIds: string[], overwrite: boolean) => Promise<any>
  promoteSkill: (record: unknown, mirrorTo: string[], overwrite: boolean) => Promise<any>
  deleteSkill: (record: unknown) => Promise<any>
  copyActiveKey: () => Promise<any>
  openConfigDir: () => Promise<any>
  openPath: (p: string) => Promise<any>
  newBlankProfile: () => Promise<any>
  setOpenAtLogin: (enabled: boolean) => Promise<any>
  showMainWindow: () => Promise<any>
  quit: () => Promise<any>
  clearStatus: () => Promise<any>
  onProgress: (cb: (payload: SwitchProgressPayload) => void) => () => void
  onState: (cb: (snap: unknown) => void) => () => void
}

declare global {
  interface Window {
    apiswitch: ApiSwitchAPI
  }
}

export {}
