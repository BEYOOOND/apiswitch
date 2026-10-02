import fs from 'node:fs'
import path from 'node:path'
import type { SkillRecord, SkillScope } from '../domain/skill-models'
import { Paths } from './paths'

export interface RootSpec {
  label: string
  url: string
  scope: SkillScope
  canDelete: boolean
}

export function defaultRoots(): RootSpec[] {
  return [
    {
      label: 'shared (~/.agents/skills)',
      url: Paths.agentsSkills,
      scope: 'user',
      canDelete: true
    },
    {
      label: 'codex (~/.codex/skills)',
      url: Paths.codexSkills,
      scope: 'native',
      canDelete: false
    },
    {
      label: 'codex system',
      url: path.join(Paths.codexSkills, '.system'),
      scope: 'system',
      canDelete: false
    },
    {
      label: 'cursor (~/.cursor/skills)',
      url: Paths.cursorSkills,
      scope: 'native',
      canDelete: false
    },
    {
      label: 'cursor builtin',
      url: Paths.cursorSkillsBuiltin,
      scope: 'system',
      canDelete: false
    }
  ]
}

export function scanSkills(roots: RootSpec[] = defaultRoots()): SkillRecord[] {
  const sharedNames = sharedSkillFolderNames()
  const records: SkillRecord[] = []
  const seenPaths = new Set<string>()
  for (const root of roots) {
    if (!fs.existsSync(root.url)) continue
    records.push(...scanRootRecursive(root, seenPaths, sharedNames))
  }
  return records.sort((a, b) => {
    const c = a.category.localeCompare(b.category, undefined, { sensitivity: 'base' })
    if (c !== 0) return c
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

function sharedSkillFolderNames(): Set<string> {
  const names = new Set<string>()
  if (!fs.existsSync(Paths.agentsSkills)) return names
  walkFiles(Paths.agentsSkills, (file) => {
    if (path.basename(file) === 'SKILL.md') {
      names.add(path.basename(path.dirname(file)))
    }
  })
  return names
}

function scanRootRecursive(
  root: RootSpec,
  seenPaths: Set<string>,
  sharedNames: Set<string>
): SkillRecord[] {
  const out: SkillRecord[] = []
  walkFiles(root.url, (file) => {
    if (path.basename(file) !== 'SKILL.md') return
    const dir = path.dirname(file)
    const parts = dir.split(path.sep)
    if (parts.includes('Archive') || parts.includes('node_modules')) return

    let resolved = dir
    try {
      resolved = fs.realpathSync(dir)
    } catch {
      /* keep */
    }
    if (seenPaths.has(resolved)) return
    seenPaths.add(resolved)

    const text = safeRead(file)
    const meta = parseFrontmatterText(text)
    const folderName = path.basename(dir)
    const name = meta.name || folderName
    const rel = relativePath(dir, root.url)
    const category = categoryFromRelative(rel)
    const readme = path.join(dir, 'README.md')
    const summary = makeSummary(
      meta.description,
      stripFrontmatter(text),
      stripFrontmatter(safeRead(readme))
    )
    let isLink = false
    try {
      isLink = fs.lstatSync(dir).isSymbolicLink()
    } catch {
      /* ignore */
    }
    const inShared = root.scope === 'user' || sharedNames.has(folderName)
    const canDelete = root.canDelete && root.scope === 'user' && !isLink

    out.push({
      id: `${root.label}::${rel}`,
      name,
      description: meta.description,
      summary,
      category,
      relativePath: rel,
      scope: root.scope,
      rootLabel: root.label,
      directory: dir,
      skillFile: file,
      isSymlink: isLink,
      canDelete,
      isInSharedLayer: inShared
    })
  })
  return out
}

function walkFiles(root: string, visit: (file: string) => void): void {
  if (!fs.existsSync(root)) return
  const stack = [root]
  while (stack.length) {
    const cur = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue
      const full = path.join(cur, ent.name)
      if (ent.isDirectory()) stack.push(full)
      else if (ent.isFile() || ent.isSymbolicLink()) visit(full)
    }
  }
}

function relativePath(dir: string, root: string): string {
  const rel = path.relative(root, dir)
  return rel || path.basename(dir)
}

function categoryFromRelative(rel: string): string {
  const parts = rel.split(/[/\\]/).filter(Boolean)
  if (parts.length >= 2) return parts.slice(0, -1).join('/')
  if (parts.length === 1) return '根目录'
  return '其他'
}

export interface Frontmatter {
  name: string
  description: string
}

export function parseFrontmatterText(text: string): Frontmatter {
  const meta: Frontmatter = { name: '', description: '' }
  const trimmed = text.trim()
  if (!trimmed.startsWith('---')) return meta
  const parts = trimmed.split('---')
  if (parts.length < 3) return meta
  const lines = parts[1].split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()
    if (t.toLowerCase().startsWith('name:')) {
      meta.name = unquote(t.slice('name:'.length).trim())
      i++
      continue
    }
    if (t.toLowerCase().startsWith('description:')) {
      const rest = t.slice('description:'.length).trim()
      if (rest === '>' || rest === '|') {
        const joinSep = rest === '|' ? '\n' : ' '
        i++
        const collected: string[] = []
        while (i < lines.length) {
          const L = lines[i]
          if (L && !L.startsWith(' ') && !L.startsWith('\t') && L.includes(':')) break
          const piece = L.trim()
          if (piece) collected.push(piece)
          i++
        }
        meta.description = collected.join(joinSep)
        continue
      } else if (rest) {
        meta.description = unquote(rest)
        i++
        continue
      } else {
        i++
        const collected: string[] = []
        while (i < lines.length) {
          const L = lines[i]
          if (L && !L.startsWith(' ') && !L.startsWith('\t') && L.includes(':')) break
          const piece = L.trim()
          if (piece) collected.push(piece)
          i++
        }
        meta.description = collected.join(' ')
        continue
      }
    }
    i++
  }
  return meta
}

function unquote(v: string): string {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }
  return v
}

export function stripFrontmatter(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('---')) return trimmed
  const parts = trimmed.split('---')
  if (parts.length < 3) return trimmed
  return parts.slice(2).join('---').trim()
}

export function makeSummary(
  frontmatterDescription: string,
  skillBody: string,
  readmeBody: string
): string {
  const candidates = [frontmatterDescription, firstProse(skillBody), firstProse(readmeBody)]
  const raw = candidates.find((c) => c.trim()) ?? ''
  return clampSummary(raw, 100)
}

function firstProse(markdown: string): string {
  const lines: string[] = []
  for (const line of markdown.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) {
      if (lines.length) break
      continue
    }
    if (t.startsWith('#') || t.startsWith('```') || t.startsWith('---') || t.startsWith('|'))
      continue
    if (t.startsWith('- [')) continue
    let cleaned = t
    if (cleaned.startsWith('- ')) cleaned = cleaned.slice(2)
    cleaned = cleaned.replace(/\*/g, '').replace(/`/g, '')
    lines.push(cleaned)
    if (lines.join('').length > 120) break
  }
  return lines.join(' ')
}

function clampSummary(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) {
    return '暂无说明：可在 SKILL.md frontmatter 写 description，或补充 README。'
  }
  if (cleaned.length <= maxChars) return cleaned
  return cleaned.slice(0, maxChars).trimEnd() + '…'
}

function safeRead(p: string): string {
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}
