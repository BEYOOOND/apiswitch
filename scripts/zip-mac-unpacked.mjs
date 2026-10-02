import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version || '0.0.0'
const outDir = join(root, 'dist')

const candidates = [
  join(root, 'release', 'mac-arm64', 'ApiSwitch.app'),
  join(root, 'release', 'mac', 'ApiSwitch.app'),
  join(root, 'release', 'mac-x64', 'ApiSwitch.app')
]
const appPath = candidates.find((p) => existsSync(p))
if (!appPath) {
  console.error('Missing ApiSwitch.app under release/mac* — run electron-builder --mac dir first')
  process.exit(1)
}

const arch = appPath.includes('arm64') ? 'arm64' : appPath.includes('x64') ? 'x64' : 'universal'
const zipName = `ApiSwitch-${version}-mac-${arch}.zip`
const zipPath = join(outDir, zipName)
const versionedApp = join(outDir, `ApiSwitch-${version}.app`)
const desktopApp = join(homedir(), 'Desktop', `ApiSwitch-${version}.app`)

mkdirSync(outDir, { recursive: true })

// Versioned copies only — never write /Applications/ApiSwitch.app
for (const dest of [versionedApp, desktopApp]) {
  rmSync(dest, { recursive: true, force: true })
  const copy = spawnSync('ditto', [appPath, dest], { stdio: 'inherit' })
  if (copy.status !== 0) {
    console.error('Failed to copy app to', dest)
    process.exit(copy.status ?? 1)
  }
  console.log('Copied', dest)
}

const r = spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath], {
  stdio: 'inherit'
})
if (r.status !== 0) process.exit(r.status ?? 1)

console.log('Created', zipPath)
console.log('Source build:', appPath)
console.log('NOTE: /Applications/ApiSwitch.app was not modified')
