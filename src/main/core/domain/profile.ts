export interface CodexOptions {
  providerId: string
  model: string
}

export interface ToolOverride {
  baseURL: string
  apiKey: string
  apiKeyRef: string
}

export interface Profile {
  id: string
  name: string
  baseURL: string
  apiKey: string
  apiKeyRef: string
  targets: string[]
  codex: CodexOptions
  overrides: Record<string, ToolOverride>
}

export interface StoreData {
  schemaVersion: number
  active: string | null
  lastRelayId: string | null
  activeByTarget: Record<string, string>
  profiles: Profile[]
}

export const CURRENT_SCHEMA_VERSION = 6
export const ALLOWED_TARGETS = new Set(['codex'])
export const DEFAULT_TARGETS = ['codex']
export const ACTIVATABLE_TARGETS = new Set(['codex'])

export function defaultCodex(): CodexOptions {
  return { providerId: '', model: '' }
}

export function normalizeBaseURL(u: string): string {
  let s = u.trim()
  while (s.endsWith('/')) s = s.slice(0, -1)
  return s
}

export function createProfile(partial: Partial<Profile> & { id: string; name: string }): Profile {
  return {
    id: partial.id,
    name: partial.name,
    baseURL: normalizeBaseURL(partial.baseURL ?? ''),
    apiKey: partial.apiKey ?? '',
    apiKeyRef: partial.apiKeyRef ?? '',
    targets: [...DEFAULT_TARGETS],
    codex: { ...defaultCodex(), ...partial.codex },
    overrides: partial.overrides ?? {}
  }
}

export function resolvedProviderId(providerId: string, profileId: string): string {
  const trimmed = providerId.trim()
  if (trimmed) return trimmed
  return profileId.replace(/-/g, '_')
}

export function maskKey(key: string): string {
  if (!key) return '(empty)'
  if (key.length <= 8) return '*'.repeat(key.length)
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}

export function slugify(name: string): string {
  const lower = name.trim().toLowerCase()
  let s = lower
    .split('')
    .map((ch) => (/[a-z0-9]/.test(ch) ? ch : '_'))
    .join('')
  while (s.includes('__')) s = s.replace(/__/g, '_')
  s = s.replace(/^_+|_+$/g, '')
  return s || 'profile'
}

export function keychainRef(profileId: string, target?: string): string {
  return target ? `keychain:${profileId}:${target}` : `keychain:${profileId}`
}

export function sanitizeForExport(profile: Profile, redactSecrets: boolean): Profile {
  const copy = structuredClone(profile)
  if (redactSecrets) {
    copy.apiKey = ''
    copy.apiKeyRef = ''
    for (const k of Object.keys(copy.overrides)) {
      copy.overrides[k] = {
        ...copy.overrides[k],
        apiKey: '',
        apiKeyRef: ''
      }
    }
  }
  return copy
}

function stripNullActive(v: string | null | undefined): string | null {
  if (!v || ['', 'null', 'none', 'official'].includes(v)) return null
  return v
}

export function parseStoreData(raw: unknown): StoreData {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  let schemaVersion = typeof obj.schema_version === 'number' ? obj.schema_version : 1
  const profilesRaw = Array.isArray(obj.profiles) ? obj.profiles : []
  const profiles = profilesRaw.map((p) => parseProfile(p))

  let active = stripNullActive(obj.active as string | null | undefined)
  if (active && !profiles.some((p) => p.id === active)) active = null

  let lastRelayId = stripNullActive(obj.last_relay_id as string | null | undefined)
  if (lastRelayId && !profiles.some((p) => p.id === lastRelayId)) lastRelayId = null
  if (!lastRelayId) lastRelayId = active

  const rawMap =
    obj.active_by_target && typeof obj.active_by_target === 'object'
      ? (obj.active_by_target as Record<string, string>)
      : {}
  const activeByTarget: Record<string, string> = {}
  const codexActive = rawMap.codex
  if (codexActive && profiles.some((p) => p.id === codexActive)) {
    activeByTarget.codex = codexActive
  } else if (active) {
    activeByTarget.codex = active
  }

  if (schemaVersion < CURRENT_SCHEMA_VERSION) schemaVersion = CURRENT_SCHEMA_VERSION

  return { schemaVersion, active, lastRelayId, activeByTarget, profiles }
}

export function parseProfile(raw: unknown): Profile {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const id = String(o.id ?? 'profile')
  const codexRaw = (o.codex && typeof o.codex === 'object' ? o.codex : {}) as Record<string, unknown>
  const overridesRaw =
    o.overrides && typeof o.overrides === 'object' ? (o.overrides as Record<string, unknown>) : {}
  const overrides: Record<string, ToolOverride> = {}
  for (const [k, v] of Object.entries(overridesRaw)) {
    if (k !== 'codex') continue
    const ov = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
    overrides[k] = {
      baseURL: String(ov.base_url ?? ''),
      apiKey: String(ov.api_key ?? ''),
      apiKeyRef: String(ov.api_key_ref ?? '')
    }
  }

  return createProfile({
    id,
    name: String(o.name ?? id),
    baseURL: String(o.base_url ?? ''),
    apiKey: String(o.api_key ?? ''),
    apiKeyRef: String(o.api_key_ref ?? ''),
    targets: [...DEFAULT_TARGETS],
    codex: {
      providerId: String(codexRaw.provider_id ?? ''),
      model: String(codexRaw.model ?? '')
    },
    overrides
  })
}

export function serializeStoreData(data: StoreData): object {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    active: data.active,
    last_relay_id: data.lastRelayId,
    active_by_target: data.activeByTarget,
    profiles: data.profiles.map(serializeProfile)
  }
}

export function serializeProfile(p: Profile): object {
  return {
    id: p.id,
    name: p.name,
    base_url: p.baseURL,
    api_key: p.apiKey,
    api_key_ref: p.apiKeyRef,
    targets: [...DEFAULT_TARGETS],
    codex: { provider_id: p.codex.providerId, model: p.codex.model },
    overrides: Object.fromEntries(
      Object.entries(p.overrides)
        .filter(([k]) => k === 'codex')
        .map(([k, v]) => [k, { base_url: v.baseURL, api_key: v.apiKey, api_key_ref: v.apiKeyRef }])
    )
  }
}

export function emptyStore(): StoreData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    active: null,
    lastRelayId: null,
    activeByTarget: {},
    profiles: []
  }
}

export function profileById(data: StoreData, id: string): Profile | undefined {
  return data.profiles.find((p) => p.id === id)
}

export function activeProfile(data: StoreData): Profile | undefined {
  return data.active ? profileById(data, data.active) : undefined
}

export function lastRelayProfile(data: StoreData): Profile | undefined {
  return data.lastRelayId ? profileById(data, data.lastRelayId) : undefined
}
