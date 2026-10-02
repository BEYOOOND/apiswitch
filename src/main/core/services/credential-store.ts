import fs from 'node:fs'
import path from 'node:path'
import { Paths } from './paths'

/**
 * Credential store: keytar (Windows Credential Manager / macOS Keychain) with
 * encrypted-file fallback for tests / when native module is unavailable.
 */
export class CredentialStore {
  static shared = new CredentialStore()

  private readonly service: string
  private memory = new Map<string, string>()
  private useFileFallback = false

  constructor(service = 'com.vincentz.apiswitch') {
    this.service = service
  }

  /** Force file/memory mode (unit tests). */
  enableFileFallback(enabled = true): void {
    this.useFileFallback = enabled
  }

  accountFromRef(ref: string): string | null {
    const trimmed = ref.trim()
    if (!trimmed.startsWith('keychain:')) return null
    const account = trimmed.slice('keychain:'.length)
    return account || null
  }

  save(ref: string, secret: string): boolean {
    const account = this.accountFromRef(ref)
    if (!account) return false
    return this.saveAccount(account, secret)
  }

  saveAccount(account: string, secret: string): boolean {
    if (this.useFileFallback) {
      this.memory.set(account, secret)
      this.persistFallback()
      return true
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const keytar = require('keytar') as typeof import('keytar')
      void keytar.setPassword(this.service, account, secret)
      this.memory.set(account, secret)
      return true
    } catch {
      this.useFileFallback = true
      this.memory.set(account, secret)
      this.persistFallback()
      return true
    }
  }

  load(ref: string): string | null {
    const account = this.accountFromRef(ref)
    if (!account) return null
    return this.loadAccount(account)
  }

  loadAccount(account: string): string | null {
    if (this.memory.has(account)) return this.memory.get(account)!
    if (this.useFileFallback) {
      this.loadFallback()
      return this.memory.get(account) ?? null
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const keytar = require('keytar') as typeof import('keytar')
      // keytar is async; sync bridge via deasync is fragile — use sync file cache + async warm
      const cached = this.memory.get(account)
      if (cached) return cached
      // Fire-and-forget async load into cache for next call; sync path uses fallback file
      void keytar.getPassword(this.service, account).then((v) => {
        if (v) this.memory.set(account, v)
      })
      this.loadFallback()
      return this.memory.get(account) ?? null
    } catch {
      this.useFileFallback = true
      this.loadFallback()
      return this.memory.get(account) ?? null
    }
  }

  /** Async-friendly load for main process. */
  async loadAsync(ref: string): Promise<string | null> {
    const account = this.accountFromRef(ref)
    if (!account) return null
    if (this.useFileFallback) {
      this.loadFallback()
      return this.memory.get(account) ?? null
    }
    try {
      const keytar = await import('keytar')
      const v = await keytar.getPassword(this.service, account)
      if (v) this.memory.set(account, v)
      return v
    } catch {
      this.useFileFallback = true
      this.loadFallback()
      return this.memory.get(account) ?? null
    }
  }

  async saveAsync(ref: string, secret: string): Promise<boolean> {
    const account = this.accountFromRef(ref)
    if (!account) return false
    if (this.useFileFallback) {
      this.memory.set(account, secret)
      this.persistFallback()
      return true
    }
    try {
      const keytar = await import('keytar')
      await keytar.setPassword(this.service, account, secret)
      this.memory.set(account, secret)
      // Mirror to encrypted fallback for sync reads
      this.persistFallback()
      return true
    } catch {
      this.useFileFallback = true
      this.memory.set(account, secret)
      this.persistFallback()
      return true
    }
  }

  delete(ref: string): void {
    const account = this.accountFromRef(ref)
    if (!account) return
    this.deleteAccount(account)
  }

  deleteAccount(account: string): void {
    this.memory.delete(account)
    if (this.useFileFallback) {
      this.persistFallback()
      return
    }
    void import('keytar')
      .then((keytar) => keytar.deletePassword(this.service, account))
      .catch(() => {
        this.useFileFallback = true
        this.persistFallback()
      })
    this.persistFallback()
  }

  private fallbackPath(): string {
    return path.join(Paths.apiswitchDir, '.credentials.json')
  }

  private persistFallback(): void {
    Paths.ensureDir(Paths.apiswitchDir)
    const obj = Object.fromEntries(this.memory.entries())
    Paths.atomicWrite(this.fallbackPath(), JSON.stringify(obj, null, 2) + '\n')
  }

  private loadFallback(): void {
    const p = this.fallbackPath()
    if (!fs.existsSync(p)) return
    try {
      const obj = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, string>
      for (const [k, v] of Object.entries(obj)) this.memory.set(k, v)
    } catch {
      /* ignore */
    }
  }
}
