import type { Profile } from '../domain/profile'
import { DEFAULT_TARGETS } from '../domain/profile'
import { resolveCredentials } from '../domain/credential-resolver'
import { TargetRegistry } from '../adapters/target-registry'
import { Paths } from './paths'
import { ProfileStore } from './profile-store'

export interface SwitchResult {
  profile: Profile | null
  restored: boolean
  targets: string[]
}

export type SwitchPhase = 'preparing' | 'writing' | 'env' | 'done' | 'error'

export type SwitchProgress = (phase: SwitchPhase, message?: string) => void

export class SwitcherError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SwitcherError'
  }
}

export class Switcher {
  constructor(public store: ProfileStore = new ProfileStore()) {}

  async switchTo(id: string, onProgress?: SwitchProgress): Promise<SwitchResult> {
    const profile = this.store.load().profiles.find((p) => p.id === id)
    if (!profile) throw new SwitcherError(`profile not found: ${id}`)
    return this.apply(profile, true, onProgress)
  }

  async apply(
    profile: Profile,
    setActive = true,
    onProgress?: SwitchProgress
  ): Promise<SwitchResult> {
    onProgress?.('preparing', profile.name)
    const hydrated = this.store.hydrateSecrets(profile)
    const targets = [...DEFAULT_TARGETS]
    Paths.backup(TargetRegistry.configPaths(targets))

    try {
      onProgress?.('writing')
      for (const adapter of TargetRegistry.adapters(targets)) {
        const creds = resolveCredentials(hydrated, adapter.id, this.store.keychain)
        await adapter.apply({ profile: hydrated, credentials: creds })
      }
      onProgress?.('env')
      if (setActive) {
        this.store.setActiveForTargets(hydrated.id, targets)
      }
      onProgress?.('done')
      return { profile: hydrated, restored: false, targets }
    } catch (e) {
      onProgress?.('error', (e as Error).message)
      throw new SwitcherError((e as Error).message)
    }
  }

  async restoreOfficial(onProgress?: SwitchProgress): Promise<SwitchResult> {
    const ids = [...DEFAULT_TARGETS]
    onProgress?.('preparing', 'official')
    Paths.backup(TargetRegistry.configPaths(ids))
    try {
      onProgress?.('writing')
      for (const adapter of TargetRegistry.adapters(ids)) await adapter.clear()
      this.store.clearActiveForTargets(ids)
      onProgress?.('done')
      return { profile: null, restored: true, targets: ids }
    } catch (e) {
      onProgress?.('error', (e as Error).message)
      throw new SwitcherError((e as Error).message)
    }
  }

  async restoreTargets(
    targets: string[],
    clearActiveIfMatches = true,
    onProgress?: SwitchProgress
  ): Promise<SwitchResult> {
    const ids = targets.filter((t) => TargetRegistry.byId[t])
    if (!ids.length) throw new SwitcherError('no valid targets')
    onProgress?.('preparing')
    Paths.backup(TargetRegistry.configPaths(ids))
    try {
      onProgress?.('writing')
      for (const adapter of TargetRegistry.adapters(ids)) await adapter.clear()
      if (clearActiveIfMatches) this.store.clearActiveForTargets(ids)
      onProgress?.('done')
      return { profile: null, restored: true, targets: ids }
    } catch (e) {
      onProgress?.('error', (e as Error).message)
      throw new SwitcherError((e as Error).message)
    }
  }
}
