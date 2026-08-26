import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const FRIENDLY_ALIASES: Record<string, string> = {
  'manage-imessages': 'Local iMessage',
  'control-in-app-browser': 'In-App Browser',
  'control-chrome': 'Google Chrome Control',
  'computer-use': 'Computer Control'
}

const SPECIAL_WORDS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  chatgpt: 'ChatGPT',
  cli: 'CLI',
  cloudflare: 'Cloudflare',
  codex: 'Codex',
  csv: 'CSV',
  figjam: 'FigJam',
  github: 'GitHub',
  html: 'HTML',
  http: 'HTTP',
  https: 'HTTPS',
  imessage: 'iMessage',
  imessages: 'iMessage',
  ios: 'iOS',
  json: 'JSON',
  linkedin: 'LinkedIn',
  macos: 'macOS',
  mcp: 'MCP',
  oauth: 'OAuth',
  openai: 'OpenAI',
  pdf: 'PDF',
  powerpoint: 'PowerPoint',
  powershell: 'PowerShell',
  sdk: 'SDK',
  sharepoint: 'SharePoint',
  sql: 'SQL',
  swiftui: 'SwiftUI',
  ui: 'UI',
  url: 'URL',
  ux: 'UX',
  yaml: 'YAML'
}

const LOWERCASE_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])

export interface SkillNameSource {
  name: string
  description: string
  path: string
}

export async function resolveSkillDisplayName(skill: SkillNameSource): Promise<string> {
  const metadataName = await readMetadataDisplayName(skill.path)
  return metadataName ?? friendlySkillName(skill.name, skill.description)
}

export function friendlySkillName(technicalName: string, description = ''): string {
  const leafName = technicalName.trim().split(':').at(-1)?.trim() ?? ''
  const alias = FRIENDLY_ALIASES[leafName.toLocaleLowerCase()]
  if (alias) return alias

  if (!leafName) return descriptionTitle(description) || 'Untitled Skill'

  if (leafName.toLocaleLowerCase() === 'index') {
    const namespace = technicalName.includes(':') ? technicalName.slice(0, technicalName.lastIndexOf(':')) : ''
    return namespace ? `${friendlyIdentifierTitle(namespace)} Tools` : descriptionTitle(description) || 'Skill Catalog'
  }

  const title = friendlyIdentifierTitle(leafName)
  return title || descriptionTitle(description) || 'Untitled Skill'
}

async function readMetadataDisplayName(skillPath: string): Promise<string | null> {
  try {
    const yaml = await readFile(join(dirname(skillPath), 'agents', 'openai.yaml'), 'utf8')
    const match = /^\s*display_name:\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^#\r\n]*))/m.exec(yaml)
    const value = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
    return validDisplayName(value) ? value : null
  } catch {
    return null
  }
}

export function friendlyIdentifierTitle(value: string): string {
  const words = value
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[._/]+/g, ' ')
    .replace(/-+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return words.map((word, index) => {
    const lower = word.toLocaleLowerCase()
    if (SPECIAL_WORDS[lower]) return SPECIAL_WORDS[lower]
    if (lower === 'ma') return 'M&A'
    if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower
    return `${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`
  }).join(' ')
}

function descriptionTitle(description: string): string {
  const firstClause = description.trim().split(/[.!?;:\n]/, 1)[0]?.trim() ?? ''
  if (!firstClause) return ''
  const shortened = firstClause.length > 64 ? `${firstClause.slice(0, 61).trimEnd()}...` : firstClause
  return shortened.charAt(0).toLocaleUpperCase() + shortened.slice(1)
}

function validDisplayName(value: string): boolean {
  return Boolean(value && value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value))
}
