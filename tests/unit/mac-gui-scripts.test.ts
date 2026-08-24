import { execFile } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe.skipIf(process.platform !== 'darwin')('macOS GUI AppleScript', () => {
  it('compiles every static Accessibility helper without executing it', async () => {
    const source = await readFile(resolve('src/main/services/mac-gui-adapter.ts'), 'utf8')
    const scripts = Array.from(source.matchAll(/const ([A-Z_]+_SCRIPT) = String\.raw`([\s\S]*?)`/g))
    expect(scripts.map((match) => match[1])).toEqual(['INSPECT_SCRIPT', 'CLICK_SCRIPT', 'TYPE_SCRIPT', 'KEY_SCRIPT'])
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-applescript-'))
    for (const [index, match] of scripts.entries()) {
      await execFileAsync('/usr/bin/osacompile', ['-o', join(directory, `${index}.scpt`), '-e', match[2]!])
    }
  })
})
