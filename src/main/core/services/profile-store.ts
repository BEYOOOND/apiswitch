import fs from 'node:fs'
import {
  type Profile,
  type StoreData,
  emptyStore,
  keychainRef,
  parseProfile,
  parseStoreData,
  sanitizeForExport,
  serializeStoreData,
  slugify
} from '../domain/profile'
import { CredentialStore } from './credential-store'
import { Paths } from './paths'

export class ProfileStoreError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileStoreError'
  }
}

export class ProfileStore {
  private path: string
  readonly keychain: CredentialStore
  /** In-memory store; secrets may be present on profile objects until persist. */
  private cache: StoreData | null = null

  constructor(filePath = Paths.profiles, keychain = CredentialStore.shared) {
    this.path = filePath
    this.keychain = keychain
    Paths.ensureDir(Paths.apiswitchDir)
  }

  /** Load from disk once (or force), keep in memory, return hydrated copy. */
  load(forceReload = false): StoreData {
    if (forceReload || !this.cache) {
      this.cache = this.readFromDisk()
    }
    return this.hydratedClone(this.cache)
  }

  /** Invalidate disk cache (e.g. after external import path). */
  invalidate(): void {
    this.cache = null
  }

  private readFromDisk(): StoreData {
    if (!fs.existsSync(this.path)) return emptyStore()
    try {
      const raw = JSON.parse(fs.readFileSync(this.path, 'utf8'))
      return parseStoreData(raw)
    } catch {
      return emptyStore()
    }
  }

  private hydratedClone(data: StoreData): StoreData {
    return {
      ...data,
      profiles: data.profiles.map((p) => this.hydrateSecrets(p)),
      activeByTarget: { ...data.activeByTarget }
    }
  }

  private commit(): StoreData {
    const data = this.cache ?? emptyStore()
    this.saveToDisk(data)
    return this.hydratedClone(data)
  }

  private saveToDisk(data: StoreData): void {
    const out: StoreData = {
      ...data,
      schemaVersion: 6,
      profiles: data.profiles.map((p) => this.persistSecrets(p))
    }
    // Keep cache with empty plaintext keys matching disk, refs intact
    this.cache = {
      ...out,
      profiles: out.profiles.map((p) => structuredClone(p)),
      activeByTarget: { ...out.activeByTarget }
    }
    const text = JSON.stringify(serializeStoreData(out), null, 2) + '\n'
    Paths.atomicWrite(this.path, text)
  }

  /** @deprecated use commit path; kept for callers that pass explicit data */
  save(data: StoreData): void {
    this.cache = {
      ...data,
      profiles: data.profiles.map((p) => structuredClone(p)),
      activeByTarget: { ...data.activeByTarget }
    }
    this.saveToDisk(this.cache)
  }

  hydrateSecrets(profile: Profile): Profile {
    const p = structuredClone(profile)
    if (!p.apiKey && p.apiKeyRef) {
      const key = this.keychain.load(p.apiKeyRef)
      if (key) p.apiKey = key
    } else if (!p.apiKey && !p.apiKeyRef) {
      const ref = keychainRef(p.id)
      const key = this.keychain.load(ref)
      if (key) {
        p.apiKey = key
        p.apiKeyRef = ref
      }
    }
    for (const [target, ov] of Object.entries(p.overrides)) {
      if (!ov.apiKey && ov.apiKeyRef) {
        const key = this.keychain.load(ov.apiKeyRef)
        if (key) ov.apiKey = key
      }
      p.overrides[target] = ov
    }
    return p
  }

  persistSecrets(profile: Profile): Profile {
    const p = structuredClone(profile)
    const ref = p.apiKeyRef || keychainRef(p.id)
    const plain = p.apiKey.trim()
    if (plain) {
      this.keychain.save(ref, plain)
      p.apiKeyRef = ref
      p.apiKey = ''
    }
    const overrides: Profile['overrides'] = {}
    for (const [target, ov] of Object.entries(p.overrides)) {
      const o = { ...ov }
      const oPlain = o.apiKey.trim()
      if (oPlain) {
        const oRef = o.apiKeyRef || keychainRef(p.id, target)
        this.keychain.save(oRef, oPlain)
        o.apiKeyRef = oRef
        o.apiKey = ''
      }
      const hasURL = !!o.baseURL.trim()
      if (hasURL || o.apiKeyRef || o.apiKey) overrides[target] = o
    }
    p.overrides = overrides
    return p
  }

  uniqueId(name: string, data?: StoreData): string {
    const current = data ?? this.load()
    const base = slugify(name)
    let candidate = base
    let n = 2
    const existing = new Set(current.profiles.map((p) => p.id))
    while (existing.has(candidate)) {
      candidate = `${base}_${n}`
      n++
    }
    return candidate
  }

  upsert(profile: Profile): StoreData {
    if (!this.cache) this.cache = this.readFromDisk()
    const data = this.cache
    const idx = data.profiles.findIndex((p) => p.id === profile.id)
    if (idx >= 0) data.profiles[idx] = structuredClone(profile)
    else data.profiles.push(structuredClone(profile))
    return this.commit()
  }

  delete(id: string): StoreData {
    if (!this.cache) this.cache = this.readFromDisk()
    const data = this.cache
    const profile = data.profiles.find((p) => p.id === id)
    if (profile) {
      this.keychain.delete(profile.apiKeyRef || keychainRef(id))
      for (const [target, ov] of Object.entries(profile.overrides)) {
        this.keychain.delete(ov.apiKeyRef || keychainRef(id, target))
      }
    }
    data.profiles = data.profiles.filter((p) => p.id !== id)
    if (data.active === id) data.active = null
    data.activeByTarget = Object.fromEntries(
      Object.entries(data.activeByTarget).filter(([, v]) => v !== id)
    )
    if (!data.active && Object.values(data.activeByTarget)[0]) {
      data.active = Object.values(data.activeByTarget)[0]
    }
    return this.commit()
  }

  setActive(id: string | null): StoreData {
    if (!this.cache) this.cache = this.readFromDisk()
    const data = this.cache
    if (id && !data.profiles.some((p) => p.id === id)) {
      throw new ProfileStoreError(`profile not found: ${id}`)
    }
    data.active = id
    if (id === null) data.activeByTarget = {}
    return this.commit()
  }

  setActiveForTargets(id: string, targets: string[]): StoreData {
    if (!this.cache) this.cache = this.readFromDisk()
    const data = this.cache
    if (!data.profiles.some((p) => p.id === id)) {
      throw new ProfileStoreError(`profile not found: ${id}`)
    }
    data.active = id
    data.lastRelayId = id
    for (const t of targets) {
      if (t === 'codex') data.activeByTarget[t] = id
    }
    return this.commit()
  }

  clearActive(): StoreData {
    if (!this.cache) this.cache = this.readFromDisk()
    const data = this.cache
    data.active = null
    data.activeByTarget = {}
    return this.commit()
  }

  clearActiveForTargets(targets: string[]): StoreData {
    if (!this.cache) this.cache = this.readFromDisk()
    const data = this.cache
    for (const t of targets) delete data.activeByTarget[t]
    if (Object.keys(data.activeByTarget).length === 0) {
      data.active = null
    } else if (data.active && !Object.values(data.activeByTarget).includes(data.active)) {
      data.active = Object.values(data.activeByTarget)[0] ?? null
    }
    return this.commit()
  }

  duplicate(id: string): Profile {
    if (!this.cache) this.cache = this.readFromDisk()
    const data = this.cache
    const source = data.profiles.find((p) => p.id === id)
    if (!source) throw new ProfileStoreError(`profile not found: ${id}`)
    const hydrated = this.hydrateSecrets(source)
    const newId = this.uniqueId(source.name + ' copy', this.hydratedClone(data))
    const copy = structuredClone(hydrated)
    copy.id = newId
    copy.name = source.name + ' Copy'
    if (copy.codex.providerId === source.id || !copy.codex.providerId) copy.codex.providerId = ''
    copy.apiKeyRef = ''
    for (const t of Object.keys(copy.overrides)) {
      copy.overrides[t] = { ...copy.overrides[t], apiKeyRef: '' }
    }
    this.upsert(copy)
    return this.hydrateSecrets(copy)
  }

  exportJSON(redactSecrets: boolean): Buffer {
    let data = this.load()
    if (redactSecrets) {
      data = {
        ...data,
        profiles: data.profiles.map((p) => sanitizeForExport(p, true)),
        active: null
      }
    }
    return Buffer.from(JSON.stringify(serializeStoreData(data), null, 2) + '\n', 'utf8')
  }

  importJSON(raw: Buffer | string, replace: boolean): StoreData {
    let incoming: StoreData
    try {
      const parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'))
      if (Array.isArray(parsed)) {
        incoming = {
          ...emptyStore(),
          profiles: parsed.map((p: unknown) => parseProfile(p))
        }
      } else if (parsed && typeof parsed === 'object' && 'id' in parsed && !('profiles' in parsed)) {
        incoming = { ...emptyStore(), profiles: [parseProfile(parsed)] }
      } else {
        incoming = parseStoreData(parsed)
      }
    } catch (e) {
      throw new ProfileStoreError(`invalid import: ${(e as Error).message}`)
    }

    if (replace || !this.cache) {
      this.cache = replace ? emptyStore() : this.readFromDisk()
    }
    const data = this.cache
    for (let p of incoming.profiles) {
      if (data.profiles.some((x) => x.id === p.id)) {
        p = { ...p, id: this.uniqueId(p.name, this.hydratedClone(data)) }
      }
      const idx = data.profiles.findIndex((x) => x.id === p.id)
      if (idx >= 0) data.profiles[idx] = p
      else data.profiles.push(p)
    }
    if (!replace && incoming.active && data.profiles.some((p) => p.id === incoming.active)) {
      data.active = incoming.active
    }
    return this.commit()
  }
}
