import { normalizeBaseURL } from '../domain/profile'

export interface RemoteModel {
  id: string
  name: string
}

export async function fetchRemoteModels(
  baseURL: string,
  apiKey: string,
  timeoutMs = 15000
): Promise<RemoteModel[]> {
  const trimmedURL = normalizeBaseURL(baseURL)
  const trimmedKey = apiKey.trim()
  if (!trimmedURL || !trimmedKey) return []
  let lastError = ''
  for (const url of candidateModelURLs(trimmedURL)) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          'Content-Type': 'application/json'
        },
        signal: ctrl.signal
      })
      const text = await res.text()
      if (!res.ok) {
        lastError = `HTTP ${res.status} ${url}`
        continue
      }
      const parsed = parseModelsPayload(text)
      if (parsed.length) return parsed
      lastError = `empty models at ${url}`
    } catch (e) {
      lastError = (e as Error).message
    } finally {
      clearTimeout(timer)
    }
  }
  if (lastError) throw new Error(`拉取模型列表失败: ${lastError}`)
  return []
}

function parseModelsPayload(text: string): RemoteModel[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return []
  }
  const list = extractModelArray(raw)
  const out: RemoteModel[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (typeof item === 'string') {
      const id = item.trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push({ id, name: id })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const id = String(obj.id ?? obj.model ?? obj.name ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const name = String(obj.name ?? obj.id ?? id).trim() || id
    out.push({ id, name })
  }
  return out
}

function extractModelArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.data)) return obj.data
  if (Array.isArray(obj.models)) return obj.models
  if (Array.isArray(obj.result)) return obj.result
  return []
}

function candidateModelURLs(base: string): string[] {
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
