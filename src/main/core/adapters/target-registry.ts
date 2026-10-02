import type { ApplyContext, TargetAdapter } from '../domain/target-adapter'
import { Paths } from '../services/paths'
import { CodexWriter } from './codex-writer'

const CodexAdapter: TargetAdapter = {
  id: 'codex',
  displayName: 'Codex Desktop',
  get configPaths() {
    return [Paths.codexAuth, Paths.codexConfig]
  },
  async apply(ctx: ApplyContext) {
    await CodexWriter.apply(ctx)
  },
  async clear() {
    await CodexWriter.clear()
  }
}

export const TargetRegistry = {
  get all(): TargetAdapter[] {
    return [CodexAdapter]
  },

  get byId(): Record<string, TargetAdapter> {
    return Object.fromEntries(this.all.map((a) => [a.id, a]))
  },

  adapters(targets: string[]): TargetAdapter[] {
    const set = new Set(targets.length ? targets : ['codex'])
    return this.all.filter((a) => set.has(a.id))
  },

  configPaths(targets: string[]): string[] {
    return this.adapters(targets).flatMap((a) => a.configPaths)
  }
}
