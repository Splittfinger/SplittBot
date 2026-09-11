import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('glass workspace supports light, dark, accessibility, compact layout, and contextual navigation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'splittbot-glass-'))
  const application = await electron.launch({ args: [resolve('out/main/index.js')], env: {
    ...process.env, SPLITTBOT_DATA_DIR: directory, SPLITTBOT_TEST_MODE: '1', SPLITTBOT_DEFAULT_CWD: process.cwd(),
    SPLITTBOT_CODEX_COMMAND: process.execPath, SPLITTBOT_CODEX_ARGS_JSON: JSON.stringify([resolve('tests/fixtures/fake-app-server.mjs')])
  } })
  try {
    const page = await application.firstWindow()
    const failures: string[] = []
    page.on('pageerror', (error) => failures.push(error.message))
    await expect(page.getByText('Good to see you.')).toBeVisible()
    await page.evaluate(async () => {
      const api = globalThis.window.splittbot
      const snapshot = await api.bootstrap()
      const template = snapshot.agents[0]!
      const email = await api.agents.create({ ...template, name: 'Email Cleanup', role: 'Inbox & follow-ups', instructions: 'Review the sample inbox.', color: '#258a87', avatar: { type: 'emoji', value: '✉️' }, collaboratorIds: [] })
      await api.agents.create({ ...template, name: 'Dexter Fox', role: 'Marketing & creative', instructions: 'Review the sample brief.', color: '#d08246', avatar: { type: 'emoji', value: '🦊' }, collaboratorIds: [] })
      await api.actions.create({ title: 'Choose a direction for the launch brief', summary: 'Review the three proposed campaign directions and choose one for the next draft. Sample design-review data.', type: 'decision', priority: 'high', sourceAgentId: template.id })
      await api.actions.create({ title: 'Review the follow-up draft', summary: 'The sample follow-up is ready for your review. Nothing has been sent.', type: 'followUp', priority: 'normal', sourceAgentId: email.id })
    })
    await expect(page.getByRole('button', { name: 'Open Dexter Fox', exact: true })).toBeVisible()
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setDeviceMetricsOverride', { width: 1420, height: 900, deviceScaleFactor: 1, mobile: false })
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('.team-pane')).toBeHidden()
    await expect(page.locator('.rail .usage-summary')).toBeVisible()
    const material = await page.locator('.rail').evaluate((rail) => {
      const style = getComputedStyle(rail)
      return { blur: style.backdropFilter, edge: style.borderRadius, background: style.backgroundColor }
    })
    expect(material.blur).toContain('blur(28px)')
    expect(material.edge).toBe('22px')
    expect(material.background).toMatch(/rgba\(/)
    expect(await page.locator('.panel').first().evaluate((panel) => getComputedStyle(panel).backdropFilter)).toBe('none')
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getWindowButtonPosition())).toEqual({ x: 22, y: 22 })
    await page.screenshot({ path: test.info().outputPath('home-light.png') })

    await page.getByRole('button', { name: 'Open Dexter Fox', exact: true }).click()
    await expect(page.getByLabel('Message Dexter Fox')).toBeVisible()
    await expect(page.locator('.team-pane')).toBeVisible()
    await page.getByLabel('Search agents').fill('inbox')
    await expect(page.locator('.agent-list .agent-row')).toHaveCount(1)
    await expect(page.locator('.agent-list')).toContainText('Email Cleanup')
    await page.getByLabel('Search agents').fill('')
    await expect(page.locator('.agent-list .agent-row')).toHaveCount(3)
    await page.getByLabel('Hide agent details').click()
    await expect(page.locator('.inspector')).toBeHidden()
    await page.getByLabel('Show agent details').click()
    await expect(page.locator('.inspector')).toBeVisible()
    await page.getByLabel('Message Dexter Fox').fill('Help me shape the next campaign. Bring @Atlas in for a second opinion.')
    await page.screenshot({ path: test.info().outputPath('conversation-light.png') })

    await page.getByLabel('Actions', { exact: true }).click()
    await expect(page.getByRole('button', { name: /Choose a direction for the launch brief/ })).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('actions-light.png') })
    await page.getByLabel('Tools', { exact: true }).click()
    await expect(page.getByText('Outlook Email', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('tools-light.png') })
    await page.getByLabel('New agent', { exact: true }).click()
    await expect(page.locator('.agent-modal')).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('agent-editor-light.png') })
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await page.getByLabel('Home', { exact: true }).click()
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.screenshot({ path: test.info().outputPath('home-dark.png') })
    expect(await page.locator('.rail-button.active').evaluate((button) => getComputedStyle(button).transitionDuration)).toBe('1e-06s')

    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce', contrast: 'more' })
    expect(await page.locator('.rail').evaluate((rail) => getComputedStyle(rail).backdropFilter)).toBe('none')
    await page.emulateMedia({ colorScheme: 'light', contrast: 'no-preference' })
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })
    expect(await page.locator('.composer-box').count()).toBe(0)
    expect(await page.locator('.rail').evaluate((rail) => getComputedStyle(rail).backdropFilter)).toBe('none')
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })

    await session.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 640, deviceScaleFactor: 1, mobile: false })
    await expect(page.locator('.rail .usage-summary')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(900)
    await page.getByLabel('Agents', { exact: true }).click()
    await expect(page.getByLabel('Message Dexter Fox')).toBeVisible()
    await expect(page.locator('.inspector')).toBeHidden()
    expect(await page.locator('.conversation').evaluate((view) => view.scrollWidth <= view.clientWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath('conversation-compact.png') })
    expect(failures).toEqual([])
  } finally { await application.close() }
})
