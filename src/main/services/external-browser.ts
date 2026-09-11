import { execFile } from 'node:child_process'

export interface BrowserOpenResult {
  browserName: string
  forcedBrowser: boolean
}

type CommandRunner = (executable: string, args: string[]) => Promise<string>

interface BrowserOpenOptions {
  platform?: NodeJS.Platform
  runCommand?: CommandRunner
  fallback: (url: string) => Promise<void>
}

const DEFAULT_BROWSER_DOMAIN = 'com.apple.LaunchServices/com.apple.launchservices.secure'
const BROWSER_CONTENT_TYPE = 'com.apple.default-app.web-browser'

export async function openHttpsInBrowser(value: string, options: BrowserOpenOptions): Promise<BrowserOpenResult> {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('Only HTTPS links may be opened.')

  const platform = options.platform ?? process.platform
  const runCommand = options.runCommand ?? runExternalCommand
  if (platform === 'darwin') {
    const preferredBrowser = await readPreferredBrowser(runCommand)
    if (preferredBrowser && await tryOpenBundle(preferredBrowser, url.toString(), runCommand)) {
      return { browserName: browserDisplayName(preferredBrowser), forcedBrowser: true }
    }

    const safari = 'com.apple.Safari'
    if (await tryOpenBundle(safari, url.toString(), runCommand)) {
      return { browserName: 'Safari', forcedBrowser: true }
    }
  }

  await options.fallback(url.toString())
  return { browserName: 'your default browser', forcedBrowser: false }
}

export function findDefaultBrowserBundleId(defaultsOutput: string): string | null {
  const records = defaultsOutput.split(/\n\s*},?\s*(?=\{|\))/)
  const httpsRecord = records.find((record) => /LSHandlerURLScheme\s*=\s*"?https"?\s*;/.test(record))
  const browserRecord = records.find((record) => new RegExp(`LSHandlerContentType\\s*=\\s*"?${escapeRegExp(BROWSER_CONTENT_TYPE)}"?\\s*;`).test(record))
  for (const record of [httpsRecord, browserRecord]) {
    const roleValues = record ? [...record.matchAll(/LSHandlerRoleAll\s*=\s*"([^"\n]+)"\s*;/g)] : []
    for (let index = roleValues.length - 1; index >= 0; index -= 1) {
      const bundleId = roleValues[index]?.[1]?.trim()
      if (bundleId && /^[A-Za-z][A-Za-z0-9.-]+$/.test(bundleId)) return bundleId
    }
  }
  return null
}

async function readPreferredBrowser(runCommand: CommandRunner): Promise<string | null> {
  try {
    const output = await runCommand('/usr/bin/defaults', ['read', DEFAULT_BROWSER_DOMAIN, 'LSHandlers'])
    return findDefaultBrowserBundleId(output)
  } catch {
    return null
  }
}

async function tryOpenBundle(bundleId: string, url: string, runCommand: CommandRunner): Promise<boolean> {
  try {
    await runCommand('/usr/bin/open', ['-b', bundleId, url])
    return true
  } catch {
    return false
  }
}

function runExternalCommand(executable: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { encoding: 'utf8', timeout: 5_000, maxBuffer: 1_000_000 }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

function browserDisplayName(bundleId: string): string {
  const knownBrowsers: Record<string, string> = {
    'com.apple.safari': 'Safari',
    'com.brave.browser': 'Brave',
    'com.google.chrome': 'Google Chrome',
    'com.microsoft.edgemac': 'Microsoft Edge',
    'company.thebrowser.browser': 'Arc',
    'org.mozilla.firefox': 'Firefox'
  }
  return knownBrowsers[bundleId.toLocaleLowerCase()] ?? 'your default browser'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
