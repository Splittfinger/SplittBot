import { readFile, readdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join } from 'node:path'

export interface LocalCodexAutomation {
  id: string
  name: string
  prompt: string
  kind: string
  status: string
  rrule: string
  scheduleLabel: string
  targetThreadId: string | null
  updatedAt: string | null
}

export async function listLocalCodexAutomations(codexHome: string): Promise<LocalCodexAutomation[]> {
  const root = join(codexHome, 'automations')
  let entries: Dirent[]
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const automations = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      try {
        return parseLocalCodexAutomation(await readFile(join(root, entry.name, 'automation.toml'), 'utf8'), entry.name)
      } catch {
        return null
      }
    }))
  return automations.filter((automation): automation is LocalCodexAutomation => automation !== null)
}

export function parseLocalCodexAutomation(source: string, fallbackId = 'automation'): LocalCodexAutomation | null {
  const values = new Map<string, string | number | boolean>()
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/)
    if (!match) continue
    values.set(match[1]!, parseTomlScalar(match[2]!))
  }
  const id = text(values.get('id')) || fallbackId
  const name = text(values.get('name'))
  const prompt = text(values.get('prompt'))
  const rrule = text(values.get('rrule'))
  if (!name || !prompt || !rrule) return null
  return {
    id,
    name,
    prompt,
    kind: text(values.get('kind')) || 'scheduled',
    status: text(values.get('status')) || 'UNKNOWN',
    rrule,
    scheduleLabel: scheduleLabelFromRrule(rrule),
    targetThreadId: text(values.get('target_thread_id')) || null,
    updatedAt: epochMillisecondsToIso(values.get('updated_at'))
  }
}

export function scheduleLabelFromRrule(value: string): string {
  const normalized = value.replace(/^RRULE:/i, '')
  const fields = new Map(normalized.split(';').map((part) => {
    const [key, fieldValue = ''] = part.split('=', 2)
    return [key?.toLocaleUpperCase() ?? '', fieldValue]
  }))
  const frequency = fields.get('FREQ')?.toLocaleUpperCase()
  const hour = Number(fields.get('BYHOUR') ?? 0)
  const minute = Number(fields.get('BYMINUTE') ?? 0)
  const time = Number.isFinite(hour) && Number.isFinite(minute)
    ? new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null
  if (frequency === 'DAILY') return `Daily${time ? ` at ${time}` : ''}`
  if (frequency === 'WEEKLY') {
    const days = (fields.get('BYDAY') ?? '').split(',').filter(Boolean).map((day) => ({ MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' })[day] ?? day)
    return `Weekly${days.length ? ` on ${days.join(', ')}` : ''}${time ? ` at ${time}` : ''}`
  }
  if (frequency === 'HOURLY') return 'Hourly'
  return value
}

function parseTomlScalar(value: string): string | number | boolean {
  if (value.startsWith('"')) {
    try { return JSON.parse(value) as string } catch { return value.slice(1, -1) }
  }
  if (/^-?\d+$/.test(value)) return Number(value)
  if (value === 'true' || value === 'false') return value === 'true'
  return value
}

function text(value: string | number | boolean | undefined): string {
  return typeof value === 'string' ? value : value === undefined ? '' : String(value)
}

function epochMillisecondsToIso(value: string | number | boolean | undefined): string | null {
  const milliseconds = typeof value === 'number' ? value : Number.NaN
  if (!Number.isFinite(milliseconds)) return null
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
