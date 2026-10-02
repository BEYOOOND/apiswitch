import fs from 'node:fs'
import type { AgentRecord } from '../domain/skill-models'
import { Paths } from './paths'

export function scanAgents(): AgentRecord[] {
  const records: AgentRecord[] = []

  if (fs.existsSync(Paths.codexAgentsMarkdown)) {
    records.push({
      id: 'codex-agents-md',
      name: 'Codex AGENTS.md',
      detail: 'User-level Codex agent instructions',
      path: Paths.codexAgentsMarkdown,
      kind: 'codex'
    })
  }

  if (fs.existsSync(Paths.cursorSkillsBuiltin)) {
    records.push({
      id: 'cursor-skills-cursor',
      name: 'Cursor skills-cursor',
      detail: 'Built-in Cursor agent skill pack (read-only)',
      path: Paths.cursorSkillsBuiltin,
      kind: 'cursor'
    })
  }

  return records
}
