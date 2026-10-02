import type { Profile } from '../domain/profile'
import { resolveForProbe } from '../domain/credential-resolver'
import { CredentialStore } from './credential-store'

export interface ProbeResult {
  ok: boolean
  endpoint: string
  statusCode: number | null
  latencyMs: number
  message: string
}

export function probeSummary(r: ProbeResult): string {
  const code = r.statusCode != null ? String(r.statusCode) : '-'
  const state = r.ok ? 'OK' : 'FAIL'
  return `[${state}] HTTP ${code}  ${r.latencyMs}ms\n${r.endpoint}\n${r.message}`
}

export async function probeProfile(
  profile: Profile,
  keychain: CredentialStore = CredentialStore.shared,
  timeoutMs = 12000
): Promise<ProbeResult> {
  const creds = resolveForProbe(profile, keychain)
  return probe(creds.baseURL, creds.apiKey, timeoutMs)
}

export async function probe(
  baseURL: string,
  apiKey: string,
  timeoutMs = 12000
): Promise<ProbeResult> {
  const trimmedURL = baseURL.trim()
  const trimmedKey = apiKey.trim()
  if (!trimmedURL) {
    return { ok: false, endpoint: '', statusCode: null, latencyMs: 0, message: 'Base URL 为空' }
  }
  if (!trimmedKey) {
    return {
      ok: false,
      endpoint: trimmedURL,
      statusCode: null,
      latencyMs: 0,
      message: 'API Key 为空'
    }
  }

  let last: ProbeResult | undefined
  for (const urlString of candidateURLs(trimmedURL)) {
    const headerSets: Record<string, string>[] = [
      { Authorization: `Bearer ${trimmedKey}`, 'Content-Type': 'application/json' },
      {
        'x-api-key': trimmedKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    ]
    for (const headers of headerSets) {
      const result = await request(urlString, headers, timeoutMs)
      if (result.ok) return result
      last = result
      if (result.statusCode === 401 || result.statusCode === 403) return result
    }
  }
  return (
    last ?? {
      ok: false,
      endpoint: trimmedURL,
      statusCode: null,
      latencyMs: 0,
      message: '没有可用的探测地址'
    }
  )
}

function candidateURLs(base: string): string[] {
  let b = base
  while (b.endsWith('/')) b = b.slice(0, -1)
  const urls = [`${b}/models`]
  try {
    const u = new URL(b)
    const path = u.pathname.replace(/^\/+|\/+$/g, '')
    if (!path.endsWith('v1')) urls.push(`${b}/v1/models`)
  } catch {
    urls.push(`${b}/v1/models`)
  }
  return [...new Set(urls)]
}

async function request(
  urlString: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<ProbeResult> {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return { ok: false, endpoint: urlString, statusCode: null, latencyMs: 0, message: '无效 URL' }
  }

  const started = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ctrl.signal })
    const ms = Date.now() - started
    const bodyText = (await res.text()).slice(0, 2048)
    if (res.status >= 200 && res.status < 300) {
      let detail = '连接成功'
      try {
        const obj = JSON.parse(bodyText) as { data?: unknown[] }
        if (Array.isArray(obj.data)) detail = `连接成功，models≈${obj.data.length}`
        else if (bodyText) detail = `连接成功：${shortBody(bodyText)}`
      } catch {
        if (bodyText) detail = `连接成功：${shortBody(bodyText)}`
      }
      return { ok: true, endpoint: urlString, statusCode: res.status, latencyMs: ms, message: detail }
    }
    return {
      ok: false,
      endpoint: urlString,
      statusCode: res.status,
      latencyMs: ms,
      message: shortBody(bodyText) || `HTTP ${res.status}`
    }
  } catch (e) {
    return {
      ok: false,
      endpoint: urlString,
      statusCode: null,
      latencyMs: 0,
      message: `网络错误: ${(e as Error).message}`
    }
  } finally {
    clearTimeout(timer)
  }
}

function shortBody(body: string): string {
  const text = body.split(/\r?\n/).join(' ')
  if (text.length > 160) return text.slice(0, 157) + '...'
  return text
}
