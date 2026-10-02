import {
  activeProfile,
  lastRelayProfile,
  maskKey,
  type Profile,
  type StoreData,
  type SkillRecord,
  type AgentRecord,
  type ProbeResult,
  ProfileStore,
  Switcher,
  type SwitchProgress,
  scanSkills,
  scanAgents,
  installSkill,
  syncDirectory,
  promoteToShared,
  deleteUserSkill,
  probeProfile,
  probeSummary,
  mirrorTargets,
  Paths,
  CredentialStore,
  createProfile,
  fetchRemoteModels
} from './core'

export class AppController {
  store = new ProfileStore()
  switcher = new Switcher(this.store)
  data: StoreData = this.store.load()
  skills: SkillRecord[] = []
  agents: AgentRecord[] = []
  statusMessage = ''
  errorMessage: string | null = null
  lastProbe: ProbeResult | null = null
  probeText = 'Run a connection test to verify the endpoint.'
  isProbing = false
  isBusy = false
  busyPhase: string | null = null
  catalogLoaded = false
  private catalogPromise: Promise<void> | null = null

  constructor() {
    CredentialStore.shared.enableFileFallback(false)
    this.reloadProfiles()
    void this.ensureCatalog()
  }

  /** Profiles only — never scans skills/agents. */
  reloadProfiles(): StoreData {
    this.data = this.store.load()
    return this.data
  }

  /** Full reload including catalog (explicit refresh / Skills tab). */
  reload(): StoreData {
    this.reloadProfiles()
    this.reloadCatalog()
    return this.data
  }

  reloadCatalog(): void {
    this.skills = scanSkills()
    this.agents = scanAgents()
    this.catalogLoaded = true
  }

  ensureCatalog(): Promise<void> {
    if (this.catalogLoaded) return Promise.resolve()
    if (this.catalogPromise) return this.catalogPromise
    this.catalogPromise = new Promise((resolve) => {
      setImmediate(() => {
        try {
          this.reloadCatalog()
        } finally {
          this.catalogPromise = null
          resolve()
        }
      })
    })
    return this.catalogPromise
  }

  getSnapshot() {
    return {
      data: this.data,
      skills: this.skills,
      agents: this.agents,
      statusMessage: this.statusMessage,
      errorMessage: this.errorMessage,
      lastProbe: this.lastProbe,
      probeText: this.probeText,
      isProbing: this.isProbing,
      isBusy: this.isBusy,
      busyPhase: this.busyPhase,
      catalogLoaded: this.catalogLoaded,
      menuTitle: this.menuTitle,
      statusLine: this.statusLine,
      canActivateLastRelay: this.canActivateLastRelay,
      mirrorTargets: mirrorTargets().map((t) => ({ id: t.id, displayName: t.displayName })),
      openAtLogin: false as boolean
    }
  }

  get menuTitle(): string {
    const active = activeProfile(this.data)
    if (active) {
      const name = active.name
      if (name.length <= 10) return `AS:${name}`
      return `AS:${name.slice(0, 9)}…`
    }
    return 'ApiSwitch'
  }

  get statusLine(): string {
    const by = this.data.activeByTarget
    const bits: string[] = []
    if (by.codex) {
      const p = this.data.profiles.find((x) => x.id === by.codex)
      bits.push(`Codex · ${p?.name ?? by.codex}`)
    } else {
      bits.push('Codex · 官方')
    }
    return bits.join('  ·  ')
  }

  get canActivateLastRelay(): boolean {
    return this.data.active === null && !!lastRelayProfile(this.data)
  }

  private progress(onProgress?: SwitchProgress): SwitchProgress {
    return (phase, message) => {
      this.busyPhase = phase
      onProgress?.(phase, message)
    }
  }

  async activate(id: string, onProgress?: SwitchProgress): Promise<void> {
    this.isBusy = true
    this.busyPhase = 'preparing'
    try {
      await this.switcher.switchTo(id, this.progress(onProgress))
      this.reloadProfiles()
      this.statusMessage = 'Relay applied'
      this.errorMessage = null
    } catch (e) {
      this.errorMessage = (e as Error).message
      throw e
    } finally {
      this.isBusy = false
      this.busyPhase = null
    }
  }

  async activateLastRelay(onProgress?: SwitchProgress): Promise<void> {
    if (!this.data.lastRelayId) {
      this.errorMessage = '还没有上次中转记录，请先启用一个中转 Profile。'
      throw new Error(this.errorMessage)
    }
    await this.activate(this.data.lastRelayId, onProgress)
  }

  async restoreOfficial(onProgress?: SwitchProgress): Promise<void> {
    this.isBusy = true
    this.busyPhase = 'preparing'
    try {
      await this.switcher.restoreOfficial(this.progress(onProgress))
      this.reloadProfiles()
      this.lastProbe = null
      this.probeText = '已恢复 Codex 官方 Plus（ChatGPT 登录）。'
      this.statusMessage = 'Codex Official'
      this.errorMessage = null
    } catch (e) {
      this.errorMessage = (e as Error).message
      throw e
    } finally {
      this.isBusy = false
      this.busyPhase = null
    }
  }

  async restoreTargets(targets: string[], onProgress?: SwitchProgress): Promise<void> {
    this.isBusy = true
    try {
      await this.switcher.restoreTargets(targets, true, this.progress(onProgress))
      this.reloadProfiles()
      this.statusMessage = `Cleared: ${targets.join(', ')}`
    } finally {
      this.isBusy = false
      this.busyPhase = null
    }
  }

  async upsert(
    profile: Profile,
    activate: boolean,
    onProgress?: SwitchProgress
  ): Promise<boolean> {
    let p = profile
    if (!p.name.trim()) p = { ...p, name: p.id }
    this.store.upsert(p)
    this.reloadProfiles()
    if (activate) {
      this.isBusy = true
      try {
        await this.switcher.switchTo(p.id, this.progress(onProgress))
        this.reloadProfiles()
      } finally {
        this.isBusy = false
        this.busyPhase = null
      }
    }
    this.statusMessage = activate ? '已保存并启用 Codex' : '已保存'
    return true
  }

  async delete(id: string, restoreIfActive: boolean): Promise<void> {
    const profile = this.data.profiles.find((p) => p.id === id)
    const activeOn = Object.entries(this.data.activeByTarget)
      .filter(([, pid]) => pid === id)
      .map(([t]) => t)
    this.store.delete(id)
    if (restoreIfActive && profile && activeOn.includes('codex')) {
      await this.switcher.restoreOfficial()
    }
    this.reloadProfiles()
  }

  duplicate(id: string): Profile {
    const copy = this.store.duplicate(id)
    this.reloadProfiles()
    this.statusMessage = `Duplicated as ${copy.name}`
    return copy
  }

  async test(
    profile: Profile,
    onProbeStart?: () => void
  ): Promise<ProbeResult> {
    this.isProbing = true
    this.probeText = `Testing ${profile.name}…`
    onProbeStart?.()
    try {
      const result = await probeProfile(profile, this.store.keychain)
      this.lastProbe = result
      this.probeText = probeSummary(result)
      return result
    } finally {
      this.isProbing = false
    }
  }

  /** Fetch OpenAI-compatible model ids for the profile credentials. */
  async fetchModels(profile: Profile): Promise<{ id: string; name: string }[]> {
    const hydrated = this.store.hydrateSecrets(profile)
    const baseURL = hydrated.baseURL.trim()
    const apiKey = hydrated.apiKey.trim()
    if (!baseURL || !apiKey) {
      throw new Error('请先填写 Base URL 与 API Key')
    }
    const models = await fetchRemoteModels(baseURL, apiKey)
    if (!models.length) throw new Error('中转站未返回任何模型')
    this.statusMessage = `已拉取 ${models.length} 个模型`
    this.errorMessage = null
    return models
  }

  exportJSON(redactSecrets: boolean): Buffer {
    return this.store.exportJSON(redactSecrets)
  }

  importJSON(raw: Buffer | string, replace: boolean): void {
    this.store.importJSON(raw, replace)
    this.reloadProfiles()
    this.statusMessage = 'Imported'
  }

  installSkillFrom(path: string, mirrorTo: string[], overwrite: boolean): void {
    installSkill(path, { mirrorTo, overwrite })
    this.reloadCatalog()
    this.statusMessage = 'Skill installed'
  }

  syncSkill(record: SkillRecord, toolIds: string[], overwrite: boolean): void {
    syncDirectory(record.directory, toolIds, overwrite)
    this.reloadCatalog()
    this.statusMessage = `Synced ${record.name}`
  }

  promoteSkill(record: SkillRecord, mirrorTo: string[], overwrite: boolean): void {
    promoteToShared(record, mirrorTo, overwrite)
    this.reloadCatalog()
    this.statusMessage = `Promoted ${record.name} to shared`
  }

  deleteSkill(record: SkillRecord): void {
    deleteUserSkill(record)
    this.reloadCatalog()
    this.statusMessage = `Deleted ${record.name}`
  }

  copyActiveKey(): string | null {
    const profile = activeProfile(this.data)
    if (!profile) {
      this.errorMessage = 'No API key in official mode.'
      return null
    }
    const key = profile.apiKey || this.store.keychain.load(profile.apiKeyRef) || ''
    if (!key) {
      this.errorMessage = 'No API key in official mode.'
      return null
    }
    this.statusMessage = `Copied ${maskKey(key)}`
    return key
  }

  openConfigDir(): string {
    Paths.ensureDir(Paths.apiswitchDir)
    return Paths.apiswitchDir
  }

  newBlankProfile(): Profile {
    // Placeholder id; UI syncs id from name until the user edits it manually.
    const id = this.store.uniqueId('relay')
    return createProfile({
      id,
      name: '',
      baseURL: '',
      apiKey: '',
      targets: ['codex']
    })
  }
}
