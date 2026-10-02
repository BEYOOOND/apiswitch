import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { platform } from 'node:os'

const execFileAsync = promisify(execFile)

/**
 * Inject user-level environment variables.
 * Windows: batch HKCU\Environment via PowerShell (async, single process).
 * macOS (dev): launchctl setenv
 */
export const SessionEnv = {
  codexKeys: ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'CODEX_API_KEY'] as const,

  get relayKeys(): string[] {
    return [...this.codexKeys]
  },

  async set(values: Record<string, string>): Promise<void> {
    const plat = platform()
    if (plat === 'win32') {
      await setWinUserEnvBatch(values)
      return
    }
    if (plat === 'darwin') {
      for (const [key, value] of Object.entries(values)) {
        try {
          await execFileAsync('/bin/launchctl', ['setenv', key, value])
        } catch {
          /* ignore */
        }
        process.env[key] = value
      }
      return
    }
    for (const [key, value] of Object.entries(values)) {
      process.env[key] = value
    }
  },

  async unset(keys: string[]): Promise<void> {
    const plat = platform()
    if (plat === 'win32') {
      await deleteWinUserEnvBatch(keys)
      return
    }
    if (plat === 'darwin') {
      for (const key of keys) {
        try {
          await execFileAsync('/bin/launchctl', ['unsetenv', key])
        } catch {
          /* ignore */
        }
        delete process.env[key]
      }
      return
    }
    for (const key of keys) delete process.env[key]
  }
}

function escapePsSingleQuoted(s: string): string {
  return s.replace(/'/g, "''")
}

async function setWinUserEnvBatch(values: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value
  }
  const entries = Object.entries(values)
  if (!entries.length) return

  const assigns = entries
    .map(
      ([key, value]) =>
        `[System.Environment]::SetEnvironmentVariable('${escapePsSingleQuoted(key)}','${escapePsSingleQuoted(value)}','User')`
    )
    .join('; ')

  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', assigns],
      { windowsHide: true, timeout: 15000 }
    )
  } catch {
    /* process.env already updated */
  }
}

async function deleteWinUserEnvBatch(keys: string[]): Promise<void> {
  for (const key of keys) delete process.env[key]
  if (!keys.length) return

  const deletes = keys
    .map(
      (key) =>
        `[System.Environment]::SetEnvironmentVariable('${escapePsSingleQuoted(key)}',$null,'User')`
    )
    .join('; ')

  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', deletes],
      { windowsHide: true, timeout: 15000 }
    )
  } catch {
    /* ignore */
  }
}
