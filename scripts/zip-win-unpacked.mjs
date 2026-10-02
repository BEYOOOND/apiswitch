import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version || '0.0.0'
const unpacked = join(root, 'release', 'win-unpacked')
const outDir = join(root, 'dist')
const zipName = `ApiSwitch-${version}-win-x64.zip`
const zipPath = join(outDir, zipName)

if (!existsSync(unpacked)) {
  console.error('Missing release/win-unpacked — run electron-builder --win dir first')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
const r = spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', unpacked, zipPath], {
  stdio: 'inherit'
})
if (r.status !== 0) {
  const z = spawnSync('zip', ['-r', zipPath, 'win-unpacked'], {
    cwd: join(root, 'release'),
    stdio: 'inherit'
  })
  if (z.status !== 0) process.exit(z.status ?? 1)
}

console.log('Created', zipPath)
