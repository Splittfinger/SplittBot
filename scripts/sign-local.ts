import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const release = process.env.SPLITTBOT_RELEASE_DIR ? resolve(process.env.SPLITTBOT_RELEASE_DIR) : join(process.cwd(), 'release')
const entitlements = join(process.cwd(), 'build', 'entitlements.mac.plist')
const appDirectory = process.env.SPLITTBOT_PACKAGED_APP_PATH
  ? resolve(process.env.SPLITTBOT_PACKAGED_APP_PATH)
  : join(release, process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'SplittBot.app')

if (!existsSync(appDirectory)) throw new Error(`Packaged SplittBot.app was not found at ${appDirectory}. Set SPLITTBOT_PACKAGED_APP_PATH for a different build target.`)
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--entitlements', entitlements, '--sign', '-', appDirectory], { stdio: 'inherit' })
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appDirectory], { stdio: 'inherit' })
process.stdout.write(`Locally signed and verified ${appDirectory}\n`)
