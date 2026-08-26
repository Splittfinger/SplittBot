import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveCodexLaunch } from '../../src/main/codex/runtime'

const originalCommand = process.env.SPLITTBOT_CODEX_COMMAND
const originalArgs = process.env.SPLITTBOT_CODEX_ARGS_JSON
const originalPath = process.env.SPLITTBOT_CODEX_PATH
const originalHome = process.env.SPLITTBOT_CODEX_HOME

afterEach(() => {
  restore('SPLITTBOT_CODEX_COMMAND', originalCommand)
  restore('SPLITTBOT_CODEX_ARGS_JSON', originalArgs)
  restore('SPLITTBOT_CODEX_PATH', originalPath)
  restore('SPLITTBOT_CODEX_HOME', originalHome)
})

describe('resolveCodexLaunch', () => {
  it('prefers a packaged architecture-specific runtime and app-owned profile', async () => {
    delete process.env.SPLITTBOT_CODEX_COMMAND
    delete process.env.SPLITTBOT_CODEX_ARGS_JSON
    delete process.env.SPLITTBOT_CODEX_PATH
    delete process.env.SPLITTBOT_CODEX_HOME
    const resources = await mkdtemp(join(tmpdir(), 'splittbot-runtime-'))
    const directory = join(resources, 'runtime', `${process.platform}-${process.arch}`)
    const executable = join(directory, 'codex')
    await mkdir(directory, { recursive: true })
    await writeFile(executable, '#!/bin/sh\necho fake-codex\n')
    await chmod(executable, 0o755)
    await writeFile(join(directory, 'runtime-manifest.json'), JSON.stringify({ version: 'codex-cli test' }))

    expect(resolveCodexLaunch(resources, '/tmp/splittbot-profile')).toEqual({
      command: executable,
      argsPrefix: [],
      source: 'bundled SplittBot runtime',
      home: '/tmp/splittbot-profile',
      bundled: true,
      version: 'codex-cli test'
    })
  })

  it('keeps explicit development overrides ahead of packaged discovery', () => {
    process.env.SPLITTBOT_CODEX_COMMAND = process.execPath
    process.env.SPLITTBOT_CODEX_ARGS_JSON = JSON.stringify(['fixture.mjs'])
    process.env.SPLITTBOT_CODEX_HOME = '/tmp/override-profile'
    expect(resolveCodexLaunch('/tmp/resources', '/tmp/default-profile')).toMatchObject({
      command: process.execPath,
      argsPrefix: ['fixture.mjs'],
      source: 'environment override',
      home: '/tmp/override-profile',
      bundled: false
    })
  })
})

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
