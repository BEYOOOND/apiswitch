import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let homeOverride: string | null = null

export const Paths = {
  setHomeOverride(dir: string | null) {
    homeOverride = dir
  },

  get home(): string {
    return homeOverride ?? os.homedir()
  },

  get apiswitchDir(): string {
    return path.join(this.home, '.apiswitch')
  },
  get profiles(): string {
    return path.join(this.apiswitchDir, 'profiles.json')
  },
  get activeEnv(): string {
    return path.join(this.apiswitchDir, 'active.env')
  },
  get backupsDir(): string {
    return path.join(this.apiswitchDir, 'backups')
  },
  get chatgptTokensBackup(): string {
    return path.join(this.apiswitchDir, 'chatgpt_tokens.backup.json')
  },
  get bearerTokenFile(): string {
    return path.join(this.apiswitchDir, 'codex_bearer_token')
  },

  get codexDir(): string {
    return path.join(this.home, '.codex')
  },
  get codexAuth(): string {
    return path.join(this.codexDir, 'auth.json')
  },
  get codexConfig(): string {
    return path.join(this.codexDir, 'config.toml')
  },
  get codexSkills(): string {
    return path.join(this.codexDir, 'skills')
  },
  get codexAgentsMarkdown(): string {
    return path.join(this.codexDir, 'AGENTS.md')
  },

  get agentsDir(): string {
    return path.join(this.home, '.agents')
  },
  get agentsSkills(): string {
    return path.join(this.agentsDir, 'skills')
  },

  get cursorDir(): string {
    return path.join(this.home, '.cursor')
  },
  get cursorSkills(): string {
    return path.join(this.cursorDir, 'skills')
  },
  get cursorSkillsBuiltin(): string {
    return path.join(this.cursorDir, 'skills-cursor')
  },

  ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    }
  },

  atomicWrite(filePath: string, content: string, mode = 0o600): void {
    this.ensureDir(path.dirname(filePath))
    const tmp = path.join(
      path.dirname(filePath),
      `.${path.basename(filePath)}.tmp.${process.pid}`
    )
    fs.writeFileSync(tmp, content, { encoding: 'utf8', mode })
    fs.renameSync(tmp, filePath)
    try {
      fs.chmodSync(filePath, mode)
    } catch {
      /* Windows may ignore mode */
    }
  },

  backup(urls: string[]): string | null {
    const existing = urls.filter((u) => fs.existsSync(u))
    if (existing.length === 0) return null
    const stamp = new Date().toISOString().replace(/:/g, '')
    const dest = path.join(this.backupsDir, stamp)
    this.ensureDir(dest)
    for (const u of existing) {
      const target = path.join(dest, path.basename(u))
      try {
        fs.copyFileSync(u, target)
      } catch {
        /* skip */
      }
    }
    return dest
  }
}
