export type SkillScope = 'user' | 'system' | 'project' | 'native'

export interface SkillRecord {
  id: string
  name: string
  description: string
  summary: string
  category: string
  relativePath: string
  scope: SkillScope
  rootLabel: string
  directory: string
  skillFile: string
  isSymlink: boolean
  canDelete: boolean
  isInSharedLayer: boolean
}

export interface AgentRecord {
  id: string
  name: string
  detail: string
  path: string
  kind: string
}

export type ToolKind = 'desktop' | 'cli' | 'ide' | 'placeholder'

export interface ToolDescriptor {
  id: string
  displayName: string
  kind: ToolKind
  skillsRoots: string[]
  supportsAPIRelay: boolean
  supportsSkillMirror: boolean
}
