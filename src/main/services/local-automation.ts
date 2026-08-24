import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ShortcutResult {
  output: string
  stdout: string
}

export class LocalAutomationService {
  constructor(private readonly command = '/usr/bin/shortcuts') {}

  async listShortcuts(): Promise<string[]> {
    const { stdout } = await execFileAsync(this.command, ['list'], { timeout: 15_000, maxBuffer: 1_000_000 })
    return stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }

  async runShortcut(name: string, input: string): Promise<ShortcutResult> {
    const installed = await this.listShortcuts()
    if (!installed.includes(name)) throw new Error(`The Shortcut “${name}” is not installed.`)
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'splittbot-shortcut-'))
    const inputPath = join(temporaryDirectory, 'input.txt')
    const outputPath = join(temporaryDirectory, 'output.txt')
    try {
      await writeFile(inputPath, input, { encoding: 'utf8', mode: 0o600 })
      const { stdout } = await execFileAsync(this.command, ['run', name, '--input-path', inputPath, '--output-path', outputPath], {
        timeout: 120_000,
        maxBuffer: 2_000_000
      })
      let output = ''
      try { output = await readFile(outputPath, 'utf8') } catch { output = stdout }
      return { output, stdout }
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }
}
