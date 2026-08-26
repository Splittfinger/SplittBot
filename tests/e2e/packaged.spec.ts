import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('packaged and locally signed macOS app launches with isolated renderer', async () => {
  const appBundle = process.env.SPLITTBOT_PACKAGED_APP_PATH || readdirSync(resolve('release'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
    .map((entry) => resolve('release', entry.name, 'SplittBot.app'))
    .find(existsSync)
  expect(appBundle).toBeTruthy()
  const executable = join(appBundle!, 'Contents', 'MacOS', 'SplittBot')
  expect(existsSync(join(appBundle!, 'Contents', 'Resources', 'icon.icns'))).toBe(true)
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-packaged-'))
  const application = await electron.launch({
    executablePath: executable,
    env: {
      ...process.env,
      SPLITTBOT_DATA_DIR: dataDirectory,
      SPLITTBOT_TEST_MODE: '1',
      SPLITTBOT_DEFAULT_CWD: process.cwd(),
      SPLITTBOT_CODEX_COMMAND: process.execPath,
      SPLITTBOT_CODEX_ARGS_JSON: JSON.stringify([resolve('tests/fixtures/fake-app-server.mjs')])
    }
  })
  const window = await application.firstWindow()
  await expect(window.getByText('Good to see you.')).toBeVisible()
  expect(await window.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
  await application.close()
})

test('packaged app starts its bundled runtime with no external Codex command', async () => {
  const appBundle = process.env.SPLITTBOT_PACKAGED_APP_PATH || readdirSync(resolve('release'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
    .map((entry) => resolve('release', entry.name, 'SplittBot.app'))
    .find(existsSync)
  expect(appBundle).toBeTruthy()
  const executable = join(appBundle!, 'Contents', 'MacOS', 'SplittBot')
  const runtime = join(appBundle!, 'Contents', 'Resources', 'runtime', `darwin-${process.arch}`, 'codex')
  const manifest = join(appBundle!, 'Contents', 'Resources', 'runtime', `darwin-${process.arch}`, 'runtime-manifest.json')
  expect(existsSync(runtime)).toBe(true)
  expect(existsSync(manifest)).toBe(true)
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-standalone-'))
  const application = await electron.launch({
    executablePath: executable,
    env: {
      ...process.env,
      PATH: '/usr/bin:/bin',
      SPLITTBOT_DATA_DIR: dataDirectory,
      SPLITTBOT_TEST_MODE: '1',
      SPLITTBOT_DEFAULT_CWD: process.cwd(),
      SPLITTBOT_CODEX_COMMAND: '',
      SPLITTBOT_CODEX_ARGS_JSON: '',
      SPLITTBOT_CODEX_PATH: '',
      SPLITTBOT_CODEX_HOME: ''
    }
  })
  const window = await application.firstWindow()
  await expect(window.getByText('Good to see you.')).toBeVisible({ timeout: 30_000 })
  await window.getByLabel('Settings').click()
  await expect(window.getByRole('heading', { name: 'Bundled with SplittBot' })).toBeVisible()
  await expect(window.getByText(/codex-profile/)).toBeVisible()
  await application.close()
})
