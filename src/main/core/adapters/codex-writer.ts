import fs from 'node:fs'
import type { ApplyContext } from '../domain/target-adapter'
import { Paths } from '../services/paths'
import { SessionEnv } from '../services/session-env'
import { resolvedProviderId } from '../domain/profile'

export const CodexWriter = {
  async apply(ctx: ApplyContext): Promise<void> {
    this.writeAuth(ctx)
    this.writeConfig(ctx)
    this.writeBearerFile(ctx.credentials.apiKey)
    await SessionEnv.set({
      OPENAI_API_KEY: ctx.credentials.apiKey,
      CODEX_API_KEY: ctx.credentials.apiKey,
      OPENAI_BASE_URL: ctx.credentials.baseURL
    })
  },

  async clear(): Promise<void> {
    this.clearAuth()
    if (fs.existsSync(Paths.codexConfig)) this.clearConfig()
    try {
      if (fs.existsSync(Paths.bearerTokenFile)) fs.unlinkSync(Paths.bearerTokenFile)
    } catch {
      /* ignore */
    }
    await SessionEnv.unset([...SessionEnv.codexKeys])
  },

  writeBearerFile(apiKey: string): void {
    Paths.ensureDir(Paths.apiswitchDir)
    Paths.atomicWrite(Paths.bearerTokenFile, apiKey + '\n')
  },

  loadJSONObject(filePath: string): Record<string, unknown> {
    try {
      const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  },

  writeJSONObject(dict: Record<string, unknown>, filePath: string): void {
    const text = JSON.stringify(dict, replacerSorted, 2) + '\n'
    Paths.atomicWrite(filePath, text)
  },

  writeAuth(ctx: ApplyContext): void {
    const auth = this.loadJSONObject(Paths.codexAuth)
    if (auth.tokens !== undefined) {
      const backup: Record<string, unknown> = {
        tokens: auth.tokens,
        last_refresh: auth.last_refresh,
        saved_at: new Date().toISOString()
      }
      for (const k of Object.keys(backup)) {
        if (backup[k] === undefined || backup[k] === null) delete backup[k]
      }
      this.writeJSONObject(backup, Paths.chatgptTokensBackup)
      delete auth.tokens
      delete auth.last_refresh
    }
    auth.OPENAI_API_KEY = ctx.credentials.apiKey
    auth.auth_mode = 'api_key'
    this.writeJSONObject(auth, Paths.codexAuth)
  },

  clearAuth(): void {
    const auth = this.loadJSONObject(Paths.codexAuth)
    auth.OPENAI_API_KEY = null
    if (fs.existsSync(Paths.chatgptTokensBackup)) {
      const backup = this.loadJSONObject(Paths.chatgptTokensBackup)
      if (backup.tokens !== undefined) auth.tokens = backup.tokens
      if (backup.last_refresh !== undefined) auth.last_refresh = backup.last_refresh
      auth.auth_mode = 'chatgpt'
    } else if (auth.tokens !== undefined) {
      auth.auth_mode = 'chatgpt'
    } else if (auth.auth_mode === 'api_key') {
      delete auth.auth_mode
    }
    this.writeJSONObject(auth, Paths.codexAuth)
  },

  writeConfig(ctx: ApplyContext): void {
    const profile = ctx.profile
    const providerId = resolvedProviderId(profile.codex.providerId, profile.id)
    const existing = fs.existsSync(Paths.codexConfig)
      ? fs.readFileSync(Paths.codexConfig, 'utf8')
      : ''
    const updated = TOMLPatch.upsertModelProvider(
      existing,
      providerId,
      profile.name,
      ctx.credentials.baseURL,
      ctx.credentials.apiKey,
      profile.codex.model || null
    )
    Paths.atomicWrite(Paths.codexConfig, updated)
  },

  clearConfig(): void {
    if (!fs.existsSync(Paths.codexConfig)) return
    const existing = fs.readFileSync(Paths.codexConfig, 'utf8')
    Paths.atomicWrite(Paths.codexConfig, TOMLPatch.clearRelayOverrides(existing))
  }
}

function replacerSorted(_key: string, value: unknown): unknown {
  return value
}

export const TOMLPatch = {
  upsertModelProvider(
    source: string,
    providerId: string,
    name: string,
    baseURL: string,
    apiKey: string,
    model: string | null
  ): string {
    let text = source
    text = setTopLevelString(text, 'model_provider', providerId)
    text = setTopLevelString(text, 'openai_base_url', baseURL)
    if (model) text = setTopLevelString(text, 'model', model)

    const header = `[model_providers.${providerId}]`
    const block = `${header}
name = "${escapeToml(name)}"
base_url = "${escapeToml(baseURL)}"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
env_key = "OPENAI_API_KEY"
experimental_bearer_token = "${escapeToml(apiKey)}"
`

    const range = findTableRange(text, header)
    if (range) {
      text = text.slice(0, range[0]) + block + '\n' + text.slice(range[1])
    } else {
      if (text && !text.endsWith('\n')) text += '\n'
      if (text && !text.endsWith('\n\n')) text += '\n'
      text += block
      if (!text.endsWith('\n')) text += '\n'
    }
    return text
  },

  clearRelayOverrides(source: string): string {
    let text = removeTopLevelKey(source, 'model_provider')
    text = removeTopLevelKey(text, 'openai_base_url')
    return text
  }
}

function escapeToml(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function setTopLevelString(source: string, key: string, value: string): string {
  const pattern = new RegExp(`^${escapeRegExp(key)}\\s*=\\s*.*$`, 'm')
  const line = `${key} = "${escapeToml(value)}"`
  if (pattern.test(source)) return source.replace(pattern, line)
  if (!source) return line + '\n'
  let text = source
  if (!text.endsWith('\n')) text += '\n'
  return line + '\n' + text
}

function removeTopLevelKey(source: string, key: string): string {
  const pattern = new RegExp(`^${escapeRegExp(key)}\\s*=\\s*.*\\n?`, 'm')
  return source.replace(pattern, '')
}

function findTableRange(text: string, header: string): [number, number] | null {
  const start = text.indexOf(header)
  if (start < 0) return null
  let idx = start + header.length
  while (idx < text.length) {
    if (text[idx] === '\n') {
      const next = idx + 1
      if (next < text.length && text[next] === '[') return [start, next]
    }
    idx++
  }
  return [start, text.length]
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
