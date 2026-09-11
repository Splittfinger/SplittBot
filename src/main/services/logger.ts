import { appendFile, chmod, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const SECRET_KEY = /(api[-_]?key|token|authorization|password|secret|cookie|code|credential)/i
const SECRET_VALUE = /(sk-[a-z0-9_-]{8,}|bearer\s+[a-z0-9._-]{8,})/gi

export function redact(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(SECRET_VALUE, '[REDACTED]')
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : redact(item)])
    )
  }
  return value
}

export class JsonLogger {
  constructor(private readonly path: string) {}

  async write(level: 'info' | 'warn' | 'error', event: string, detail: unknown = {}): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
    const record = JSON.stringify({ at: new Date().toISOString(), level, event, detail: redact(detail) })
    await appendFile(this.path, `${record}\n`, { encoding: 'utf8', mode: 0o600 })
    // Upgrade existing logs as well as newly created files. Logs may contain
    // provider diagnostics even after credential redaction.
    await chmod(this.path, 0o600)
  }
}
