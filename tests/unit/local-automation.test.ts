import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LocalAutomationService } from '../../src/main/services/local-automation'

describe('LocalAutomationService', () => {
  it('lists and runs a Shortcut through structured arguments and a private input file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-shortcut-test-'))
    const executable = join(directory, 'fake-shortcuts.mjs')
    await writeFile(executable, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
const args = process.argv.slice(2)
if (args[0] === 'list') process.stdout.write('Draft Brief\\nSafe Notes\\n')
if (args[0] === 'run') {
  const input = args[args.indexOf('--input-path') + 1]
  const output = args[args.indexOf('--output-path') + 1]
  writeFileSync(output, 'DRAFT: ' + readFileSync(input, 'utf8'))
}
`)
    await chmod(executable, 0o700)
    const service = new LocalAutomationService(executable)
    await expect(service.listShortcuts()).resolves.toEqual(['Draft Brief', 'Safe Notes'])
    await expect(service.runShortcut('Draft Brief', 'Review only')).resolves.toMatchObject({ output: 'DRAFT: Review only' })
    await expect(service.runShortcut('Missing Shortcut', 'No')).rejects.toThrow('not installed')
  })
})
