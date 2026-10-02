import type { Profile } from './profile'
import type { CredentialStore } from '../services/credential-store'

export interface ResolvedCredentials {
  baseURL: string
  apiKey: string
}

export function resolveCredentials(
  profile: Profile,
  target: string,
  keychain: CredentialStore
): ResolvedCredentials {
  const override = profile.overrides[target]
  const baseFromOverride = override?.baseURL.trim() ?? ''
  const base = baseFromOverride || profile.baseURL

  const keyFromOverridePlain = override?.apiKey.trim() ?? ''
  if (keyFromOverridePlain) {
    return { baseURL: base, apiKey: keyFromOverridePlain }
  }

  if (override?.apiKeyRef) {
    const key = keychain.load(override.apiKeyRef)
    if (key) return { baseURL: base, apiKey: key }
  }

  if (profile.apiKeyRef) {
    const key = keychain.load(profile.apiKeyRef)
    if (key) return { baseURL: base, apiKey: key }
  }

  return { baseURL: base, apiKey: profile.apiKey.trim() }
}

export function resolveForProbe(
  profile: Profile,
  keychain: CredentialStore
): ResolvedCredentials {
  if (profile.apiKeyRef) {
    const key = keychain.load(profile.apiKeyRef)
    if (key) return { baseURL: profile.baseURL, apiKey: key }
  }
  return { baseURL: profile.baseURL, apiKey: profile.apiKey }
}
