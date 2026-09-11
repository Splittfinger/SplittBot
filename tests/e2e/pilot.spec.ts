import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setDesktopViewport } from './display'

test('pilot end dates persist and synthetic wake checks cannot be confirmed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'splittbot-pilot-'))
  const application = await electron.launch({ args: [resolve('out/main/index.js')], env: {
    ...process.env, SPLITTBOT_DATA_DIR: directory, SPLITTBOT_TEST_MODE: '1', SPLITTBOT_DEFAULT_CWD: process.cwd(),
    SPLITTBOT_CODEX_COMMAND: process.execPath, SPLITTBOT_CODEX_ARGS_JSON: JSON.stringify([resolve('tests/fixtures/fake-app-server.mjs')])
  } })
  try {
    const page = await application.firstWindow()
    await setDesktopViewport(page)
    await page.getByLabel('Routines', { exact: true }).click()
    await page.getByRole('button', { name: 'New routine' }).click()
    await page.getByLabel('Title', { exact: true }).fill('Seven-day sample pilot')
    await page.getByLabel('Routine instructions').fill('Read-only sample check. Do not send or change anything.')
    await page.getByLabel('Local time', { exact: true }).fill('09:00')
    await page.getByLabel('Routine stop date').fill('2099-09-18')
    await page.getByRole('button', { name: 'Create routine', exact: true }).click()
    await expect(page.locator('.routine-card')).toContainText('Stops after 2099-09-18')
    await page.locator('.routine-card').getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByLabel('Routine stop date')).toHaveValue('2099-09-18')
    await page.getByLabel('Routine stop date').fill('2000-01-01')
    await page.getByRole('button', { name: 'Save routine', exact: true }).click()
    await expect(page.getByText('The stop date must include at least one future scheduled run.', { exact: false })).toBeVisible()
    await expect(page.getByLabel('Routine stop date')).toHaveValue('2000-01-01')
    expect(await page.evaluate(async () => (await window.splittbot.bootstrap()).routines[0]!.schedule.stopAfterDate)).toBe('2099-09-18')
    await page.getByLabel('Settings', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Show installed SplittBot' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Full Disk Access settings' })).toBeVisible()
    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Confirm wake notification' }).click()
    await expect(page.getByText(/No recent native wake check is awaiting confirmation/)).toBeVisible()
    expect(await page.evaluate(async () => (await window.splittbot.bootstrap()).runs.length)).toBe(0)
  } finally { await application.close() }
})
