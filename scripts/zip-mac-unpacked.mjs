import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

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
// Electron mac zip is secondary; daily Mac use is native Swift (macos/)
const zipName = `ApiSwitch-${version}-mac-${arch}-electron.zip`
const zipPath = join(outDir, zipName)

mkdirSync(outDir, { recursive: true })
rmSync(zipPath, { force: true })

const r = spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath], {
  stdio: 'inherit'
})
if (r.status !== 0) process.exit(r.status ?? 1)

console.log('Created', zipPath)
console.log('Source build:', appPath)
console.log('NOTE: Prefer native macos/ for daily use. /Applications was not modified.')
