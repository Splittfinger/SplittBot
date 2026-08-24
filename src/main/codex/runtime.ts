import { accessSync, constants, existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'

export interface CodexLaunch {
  command: string
  argsPrefix: string[]
  source: string
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

export function resolveCodexLaunch(resourcesPath?: string): CodexLaunch {
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
    return { command: explicitCommand, argsPrefix, source: 'environment override' }
  }

  const explicitPath = process.env.SPLITTBOT_CODEX_PATH
  if (explicitPath) {
    if (!executable(explicitPath)) throw new Error(`Configured Codex executable is unavailable: ${explicitPath}`)
    return { command: explicitPath, argsPrefix: [], source: 'configured path' }
  }

  const candidates = [
    resourcesPath ? join(resourcesPath, 'codex') : null,
    '/Applications/ChatGPT.app/Contents/Resources/codex',
    findOnPath('codex')
  ].filter((value): value is string => Boolean(value))

  const command = candidates.find((candidate) => existsSync(candidate) && executable(candidate))
  if (!command) {
    throw new Error('Codex was not found. Install the ChatGPT desktop app or set SPLITTBOT_CODEX_PATH.')
  }
  return {
    command,
    argsPrefix: [],
    source: command.includes('ChatGPT.app') ? 'ChatGPT desktop runtime' : 'system Codex runtime'
  }
}
