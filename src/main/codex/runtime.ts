import { accessSync, constants, existsSync, readFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'

export interface CodexLaunch {
  command: string
  argsPrefix: string[]
  source: string
  home?: string
  bundled?: boolean
  version?: string
}

function executable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function findOnPath(command: string): string | null {
  if (command.includes('/')) return executable(command) ? command : null
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, command)
    if (executable(candidate)) return candidate
  }
  return null
}

export function resolveCodexLaunch(resourcesPath?: string, defaultHome?: string): CodexLaunch {
  const home = process.env.SPLITTBOT_CODEX_HOME || defaultHome
  const explicitCommand = process.env.SPLITTBOT_CODEX_COMMAND
  if (explicitCommand) {
    let argsPrefix: string[] = []
    if (process.env.SPLITTBOT_CODEX_ARGS_JSON) {
      const parsed = JSON.parse(process.env.SPLITTBOT_CODEX_ARGS_JSON) as unknown
      if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
        throw new Error('SPLITTBOT_CODEX_ARGS_JSON must be a JSON array of strings.')
      }
      argsPrefix = parsed
    }
    return { command: explicitCommand, argsPrefix, source: 'environment override', home, bundled: false }
  }

  const explicitPath = process.env.SPLITTBOT_CODEX_PATH
  if (explicitPath) {
    if (!executable(explicitPath)) throw new Error(`Configured Codex executable is unavailable: ${explicitPath}`)
    return { command: explicitPath, argsPrefix: [], source: 'configured path', home, bundled: false }
  }

  const candidates = [
    resourcesPath ? join(resourcesPath, 'runtime', `${process.platform}-${process.arch}`, 'codex') : null,
    resourcesPath ? join(resourcesPath, 'codex') : null,
    '/Applications/ChatGPT.app/Contents/Resources/codex',
    findOnPath('codex')
  ].filter((value): value is string => Boolean(value))

  const command = candidates.find((candidate) => existsSync(candidate) && executable(candidate))
  if (!command) {
    throw new Error('SplittBot could not find its bundled Codex runtime. Reinstall SplittBot, or set SPLITTBOT_CODEX_PATH for development.')
  }
  const bundled = Boolean(resourcesPath && command.startsWith(join(resourcesPath, 'runtime')))
  let version: string | undefined
  if (bundled) {
    try {
      const manifest = JSON.parse(readFileSync(join(dirname(command), 'runtime-manifest.json'), 'utf8')) as { version?: unknown }
      if (typeof manifest.version === 'string') version = manifest.version
    } catch {
      // Runtime validation during packaging is authoritative; a missing manifest only removes the display version.
    }
  }
  return {
    command,
    argsPrefix: [],
    source: bundled ? 'bundled SplittBot runtime' : command.includes('ChatGPT.app') ? 'ChatGPT desktop runtime' : 'system Codex runtime',
    home,
    bundled,
    version
  }
}
