import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const release = process.env.SPLITTBOT_RELEASE_DIR ? resolve(process.env.SPLITTBOT_RELEASE_DIR) : join(process.cwd(), 'release')
const entitlements = join(process.cwd(), 'build', 'entitlements.mac.plist')
const appDirectory = readdirSync(release, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
  .map((entry) => join(release, entry.name, 'SplittBot.app'))
  .find(existsSync)

if (!appDirectory) throw new Error('Packaged SplittBot.app was not found.')
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--entitlements', entitlements, '--sign', '-', appDirectory], { stdio: 'inherit' })
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appDirectory], { stdio: 'inherit' })
process.stdout.write(`Locally signed and verified ${appDirectory}\n`)
