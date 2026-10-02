import { Paths } from '../services/paths'
import type { ToolDescriptor } from '../domain/skill-models'

export function toolCatalog(): ToolDescriptor[] {
  return [
    {
      id: 'codex',
      displayName: 'Codex Desktop',
      kind: 'desktop',
      skillsRoots: [Paths.codexSkills],
      supportsAPIRelay: true,
      supportsSkillMirror: true
    },
    {
      id: 'cursor',
      displayName: 'Cursor',
      kind: 'ide',
      skillsRoots: [Paths.cursorSkills],
      supportsAPIRelay: false,
      supportsSkillMirror: true
    }
  ]
}

export function mirrorTargets(): ToolDescriptor[] {
  return toolCatalog().filter((t) => t.supportsSkillMirror)
}
