import { mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const releaseDir = join(process.cwd(), 'release')
const outDir = join(process.cwd(), 'dist')
mkdirSync(outDir, { recursive: true })

if (!existsSync(releaseDir)) {
  console.error('No release/ folder — run npm run dist:win first')
  process.exit(1)
}

const files = readdirSync(releaseDir).filter(
  (f) => f.endsWith('.exe') || f.endsWith('.zip') || f.endsWith('.msi')
)
for (const f of files) {
  const dest = join(outDir, f)
  copyFileSync(join(releaseDir, f), dest)
  console.log('copied', f, '→', dest)
}
if (!files.length) {
  console.warn('No installer artifacts found in release/')
}
