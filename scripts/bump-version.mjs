import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')
const confPath = join(root, 'src-tauri', 'tauri.conf.json')
const cargoTomlPath = join(root, 'src-tauri', 'Cargo.toml')
const cargoLockPath = join(root, 'src-tauri', 'Cargo.lock')

const bump = (process.argv[2] || 'patch').toLowerCase()
if (!['major', 'minor', 'patch'].includes(bump)) {
  console.error(`Unknown bump "${bump}" — expected major | minor | patch`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version)
if (!match) {
  console.error(`package.json version "${pkg.version}" is not plain semver (x.y.z)`)
  process.exit(1)
}

let [major, minor, patch] = match.slice(1).map(Number)
if (bump === 'major') (major += 1), (minor = 0), (patch = 0)
else if (bump === 'minor') (minor += 1), (patch = 0)
else patch += 1
const next = `${major}.${minor}.${patch}`

pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

const conf = JSON.parse(readFileSync(confPath, 'utf8'))
conf.version = next
writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n')

writeFileSync(cargoTomlPath, replaceBlockVersion(readFileSync(cargoTomlPath, 'utf8'), '[package]', next))
writeFileSync(cargoLockPath, replaceLockVersion(readFileSync(cargoLockPath, 'utf8'), 'vigilante', next))

console.log(next)

function replaceBlockVersion(text, header, version) {
  let inBlock = false
  let done = false
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('[')) inBlock = trimmed === header
      if (inBlock && !done && /^version\s*=/.test(trimmed)) {
        done = true
        return line.replace(/"[^"]*"/, `"${version}"`)
      }
      return line
    })
    .join('\n')
}

function replaceLockVersion(text, crate, version) {
  let inCrate = false
  let done = false
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed === '[[package]]') inCrate = false
      if (trimmed === `name = "${crate}"`) inCrate = true
      if (inCrate && !done && /^version\s*=/.test(trimmed)) {
        done = true
        return line.replace(/"[^"]*"/, `"${version}"`)
      }
      return line
    })
    .join('\n')
}
