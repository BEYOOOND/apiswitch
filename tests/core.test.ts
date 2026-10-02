import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Paths } from '../src/main/core/services/paths'
import { CredentialStore } from '../src/main/core/services/credential-store'
import { ProfileStore } from '../src/main/core/services/profile-store'
import { Switcher } from '../src/main/core/services/switcher'
import { createProfile, parseStoreData } from '../src/main/core/domain/profile'
import { TOMLPatch } from '../src/main/core/adapters/codex-writer'

let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'apiswitch-'))
  Paths.setHomeOverride(home)
  CredentialStore.shared = new CredentialStore()
  CredentialStore.shared.enableFileFallback(true)
})

afterEach(() => {
  Paths.setHomeOverride(null)
  rmSync(home, { recursive: true, force: true })
})

describe('TOMLPatch', () => {
  it('upserts model_provider and provider block', () => {
    const out = TOMLPatch.upsertModelProvider(
      '',
      'puluai',
      'Pulu',
      'https://api.example.com/v1',
      'sk-test',
      'gpt-5'
    )
    expect(out).toContain('model_provider = "puluai"')
    expect(out).toContain('[model_providers.puluai]')
    expect(out).toContain('experimental_bearer_token = "sk-test"')
  })

  it('clears relay overrides', () => {
    const src = 'model_provider = "x"\nopenai_base_url = "https://a"\nfoo = 1\n'
    const out = TOMLPatch.clearRelayOverrides(src)
    expect(out).not.toContain('model_provider')
    expect(out).not.toContain('openai_base_url')
    expect(out).toContain('foo = 1')
  })
})

describe('Switcher + CodexWriter', () => {
  it('activates relay only writing Codex', async () => {
    mkdirSync(join(home, '.codex'), { recursive: true })
    writeFileSync(
      join(home, '.codex', 'auth.json'),
      JSON.stringify({ tokens: { access: 'tok' }, auth_mode: 'chatgpt' }, null, 2)
    )

    const store = new ProfileStore(Paths.profiles, CredentialStore.shared)
    const switcher = new Switcher(store)
    const profile = createProfile({
      id: 'relay1',
      name: 'Relay One',
      baseURL: 'https://relay.example/v1',
      apiKey: 'sk-relay',
      targets: ['codex'],
      codex: { providerId: '', model: 'gpt-5' }
    })
    store.upsert(profile)
    await switcher.switchTo('relay1')

    const auth = JSON.parse(readFileSync(Paths.codexAuth, 'utf8'))
    expect(auth.OPENAI_API_KEY).toBe('sk-relay')
    expect(auth.auth_mode).toBe('api_key')
    expect(auth.tokens).toBeUndefined()
    expect(existsSync(Paths.chatgptTokensBackup)).toBe(true)
    expect(existsSync(join(home, '.config', 'opencode', 'opencode.json'))).toBe(false)

    const data = store.load()
    expect(data.active).toBe('relay1')
    expect(data.lastRelayId).toBe('relay1')
    expect(data.activeByTarget.codex).toBe('relay1')

    await switcher.restoreOfficial()
    const auth2 = JSON.parse(readFileSync(Paths.codexAuth, 'utf8'))
    expect(auth2.tokens).toEqual({ access: 'tok' })
    expect(auth2.auth_mode).toBe('chatgpt')
    const after = store.load()
    expect(after.active).toBeNull()
    expect(after.lastRelayId).toBe('relay1')
    expect(after.activeByTarget.codex).toBeUndefined()
  })
})

describe('ProfileStore schema', () => {
  it('migrates legacy OpenCode/Pi fields to Codex-only schema 6', () => {
    const migrated = parseStoreData({
      schema_version: 5,
      active: 'a',
      last_relay_id: 'a',
      active_by_target: { codex: 'a', opencode: 'a', pi: 'a' },
      profiles: [
        {
          id: 'a',
          name: 'A',
          base_url: 'https://x',
          api_key: 'secret-key',
          targets: ['codex', 'opencode', 'pi'],
          codex: { provider_id: '', model: 'gpt-5' },
          opencode: { provider_id: '', npm: '', model: 'm1', models: { m1: 'm1' } },
          pi: { provider_id: '', model: 'm1', api: 'openai-completions' }
        }
      ]
    })
    expect(migrated.schemaVersion).toBe(6)
    expect(migrated.profiles[0].targets).toEqual(['codex'])
    expect(migrated.activeByTarget).toEqual({ codex: 'a' })
    expect((migrated.profiles[0] as { opencode?: unknown }).opencode).toBeUndefined()
  })

  it('round-trips profiles with secrets in credential store', () => {
    const store = new ProfileStore(Paths.profiles, CredentialStore.shared)
    store.upsert(
      createProfile({
        id: 'a',
        name: 'A',
        baseURL: 'https://x',
        apiKey: 'secret-key'
      })
    )
    const raw = JSON.parse(readFileSync(Paths.profiles, 'utf8'))
    expect(raw.schema_version).toBe(6)
    expect(raw.profiles[0].api_key).toBe('')
    expect(raw.profiles[0].api_key_ref).toBe('keychain:a')
    expect(raw.profiles[0].targets).toEqual(['codex'])
    const loaded = store.load()
    expect(loaded.profiles[0].apiKey).toBe('secret-key')
  })

  it('upserts without redundant reload from empty disk each time', () => {
    const store = new ProfileStore(Paths.profiles, CredentialStore.shared)
    store.upsert(
      createProfile({
        id: 'b',
        name: 'B',
        baseURL: 'https://b',
        apiKey: 'k1'
      })
    )
    store.upsert(
      createProfile({
        id: 'c',
        name: 'C',
        baseURL: 'https://c',
        apiKey: 'k2'
      })
    )
    const data = store.load()
    expect(data.profiles.map((p) => p.id).sort()).toEqual(['b', 'c'])
  })
})
