import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { platform } from 'node:os'
import type { SkillRecord } from '../domain/skill-models'
import { Paths } from './paths'
import { toolCatalog } from './tool-catalog'

export class SkillSyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillSyncError'
  }
}

export function installSkill(
  source: string,
  options: { name?: string; mirrorTo: string[]; overwrite?: boolean }
): string {
  const skillFile = path.join(source, 'SKILL.md')
  if (!fs.existsSync(skillFile)) {
    throw new SkillSyncError('Source is not a skill folder (needs SKILL.md)')
  }
  const folderName =
    options.name?.trim() || path.basename(source)
  const dest = path.join(Paths.agentsSkills, folderName)
  Paths.ensureDir(Paths.agentsSkills)

  if (fs.existsSync(dest)) {
    if (options.overwrite) fs.rmSync(dest, { recursive: true, force: true })
    else throw new SkillSyncError(`Skill already exists at ${dest}`)
  }
  copyDir(source, dest)

  for (const toolId of options.mirrorTo) {
    mirrorSkill(folderName, dest, toolId, !!options.overwrite)
  }
  return dest
}

export function mirrorSkill(
  skillName: string,
  sharedDir: string,
  toolId: string,
  overwrite: boolean
): void {
  const tool = toolCatalog().find((t) => t.id === toolId)
  if (!tool?.supportsSkillMirror || !tool.skillsRoots[0]) return
  const root = tool.skillsRoots[0]
  Paths.ensureDir(root)
  const link = path.join(root, skillName)

  if (fs.existsSync(link) || isSymlink(link)) {
    if (overwrite) fs.rmSync(link, { recursive: true, force: true })
    else throw new SkillSyncError(`Target already exists: ${link}`)
  }

  try {
    fs.symlinkSync(sharedDir, link, 'dir')
  } catch {
    if (platform() === 'win32') {
      try {
        execFileSync('cmd', ['/c', 'mklink', '/J', link, sharedDir], {
          stdio: 'ignore',
          windowsHide: true
        })
        return
      } catch {
        /* fall through to copy */
      }
    }
    copyDir(sharedDir, link)
  }
}

export function deleteUserSkill(record: SkillRecord): void {
  if (!record.canDelete) {
    throw new SkillSyncError('System or native skills cannot be deleted from ApiSwitch')
  }
  fs.rmSync(record.directory, { recursive: true, force: true })
}

export function syncDirectory(dir: string, toolIds: string[], overwrite: boolean): void {
  const skillFile = path.join(dir, 'SKILL.md')
  if (!fs.existsSync(skillFile)) {
    throw new SkillSyncError('Source is not a skill folder (needs SKILL.md)')
  }
  const name = path.basename(dir)
  for (const id of toolIds) mirrorSkill(name, dir, id, overwrite)
}

export function promoteToShared(
  record: SkillRecord,
  mirrorTo: string[],
  overwrite: boolean
): string {
  return installSkill(record.directory, {
    name: path.basename(record.directory),
    mirrorTo,
    overwrite
  })
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

function copyDir(src: string, dest: string): void {
  fs.cpSync(src, dest, { recursive: true })
}
