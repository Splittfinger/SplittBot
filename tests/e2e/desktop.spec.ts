import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SqliteStore } from '../../src/main/db/store'
import { emulateAppearance, setDesktopViewport } from './display'

test('Phase 0-6 desktop flow persists agents, isolates connector accounts, gates tools, attaches images, and safely controls one GUI lane', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-e2e-'))
  const fakeLog = join(dataDirectory, 'fake.jsonl')
  const backupPath = join(dataDirectory, 'phase-4-backup.sqlite')
  const artifactPath = join(dataDirectory, 'gui-verification.md')
  const memoryExportPath = join(dataDirectory, 'maya-memory.md')
  const attachmentPath = join(dataDirectory, 'test-image.png')
  await writeFile(attachmentPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XG8QAAAAAElFTkSuQmCC', 'base64'))
  const canonicalAttachmentPath = await realpath(attachmentPath)
  const environment = {
    ...process.env,
    SPLITTBOT_DATA_DIR: dataDirectory,
    SPLITTBOT_TEST_MODE: '1',
    SPLITTBOT_DEFAULT_CWD: process.cwd(),
    SPLITTBOT_CODEX_COMMAND: process.execPath,
    SPLITTBOT_CODEX_ARGS_JSON: JSON.stringify([resolve('tests/fixtures/fake-app-server.mjs')]),
    SPLITTBOT_FAKE_LOG: fakeLog,
    SPLITTBOT_TEST_BACKUP_PATH: backupPath,
    SPLITTBOT_TEST_ARTIFACT_PATH: artifactPath,
    SPLITTBOT_TEST_MEMORY_EXPORT_PATH: memoryExportPath,
    SPLITTBOT_TEST_ATTACHMENT_PATH: attachmentPath
  }

  let application = await electron.launch({ args: [resolve('out/main/index.js')], env: environment })
  let window = await application.firstWindow()
  await emulateAppearance(window)
  await expect(window.getByText('Good to see you.')).toBeVisible()
  expect(await window.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe('undefined')
  expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getMinimumSize())).toEqual([900, 640])
  const displaySession = await window.context().newCDPSession(window)
  await displaySession.send('Emulation.setDeviceMetricsOverride', { width: 1420, height: 900, deviceScaleFactor: 1, mobile: false })
  await window.waitForTimeout(100)

  const wideLayout = await window.evaluate(() => {
    const shell = document.querySelector('.app-shell') as HTMLElement
    const rail = document.querySelector('.rail') as HTMLElement
    const teamPane = document.querySelector('.team-pane') as HTMLElement
    const railLabel = document.querySelector('.rail-label') as HTMLElement
    const panel = document.querySelector('.panel') as HTMLElement
    const mainPane = document.querySelector('.main-pane') as HTMLElement
    const bodyStyle = getComputedStyle(document.body)
    const railStyle = getComputedStyle(rail)
    return {
      section: shell.dataset.section,
      railWidth: Math.round(rail.getBoundingClientRect().width),
      teamPaneVisible: getComputedStyle(teamPane).display !== 'none',
      railLabelVisible: getComputedStyle(railLabel).display !== 'none',
      railBackground: railStyle.backgroundColor,
      mainBackground: getComputedStyle(mainPane).backgroundColor,
      panelMaterial: panel ? getComputedStyle(panel).backdropFilter || getComputedStyle(panel).getPropertyValue('-webkit-backdrop-filter') : 'none',
      fontFamily: bodyStyle.fontFamily
    }
  })
  expect(wideLayout.section).toBe('home')
  expect(wideLayout.railWidth).toBeGreaterThan(150)
  expect(wideLayout.teamPaneVisible).toBe(false)
  expect(wideLayout.railLabelVisible).toBe(true)
  expect(wideLayout.railBackground).not.toBe(wideLayout.mainBackground)
  expect(wideLayout.panelMaterial).toBe('none')
  expect(wideLayout.fontFamily.toLowerCase()).not.toContain('georgia')

  await displaySession.send('Emulation.setDeviceMetricsOverride', { width: 1210, height: 768, deviceScaleFactor: 1, mobile: false })
  await window.waitForTimeout(100)
  const homeAgentBoundary = await window.evaluate(() => {
    const grid = document.querySelector('.home-agent-grid') as HTMLElement
    const original = grid.querySelector('.home-agent') as HTMLElement
    const testCards = ['Dexter Fox', 'Email Cleanup'].map((name) => {
      const card = original.cloneNode(true) as HTMLElement
      const title = card.querySelector('strong') as HTMLElement
      const role = card.querySelector('div span') as HTMLElement
      title.textContent = name
      role.textContent = name === 'Dexter Fox' ? 'BluePanda AI Marketing Agent' : 'Outlook Inbox Triage Agent'
      grid.append(card)
      return card
    })
    const gridBounds = grid.getBoundingClientRect()
    const cards = Array.from(grid.querySelectorAll('.home-agent')) as HTMLElement[]
    const dexterTitle = testCards[0]!.querySelector('strong') as HTMLElement
    const result = {
      gridContained: grid.scrollWidth <= grid.clientWidth,
      cardsContained: cards.every((card) => {
        const bounds = card.getBoundingClientRect()
        return bounds.left >= gridBounds.left - 1 && bounds.right <= gridBounds.right + 1
      }),
      dexterNameReadable: dexterTitle.scrollWidth <= dexterTitle.clientWidth
    }
    testCards.forEach((card) => card.remove())
    return result
  })
  expect(homeAgentBoundary).toEqual({
    gridContained: true,
    cardsContained: true,
    dexterNameReadable: true
  })
  await displaySession.send('Emulation.setDeviceMetricsOverride', { width: 1420, height: 900, deviceScaleFactor: 1, mobile: false })
  await window.waitForTimeout(100)

  const usageButton = window.getByRole('button', { name: 'Codex connected, Plus plan, 38% remaining' })
  await expect(usageButton).toBeVisible()
  await expect(window.getByText('38% left', { exact: false })).toBeVisible()
  await usageButton.click()
  const usageDetails = window.getByRole('dialog', { name: 'Codex usage details' })
  await expect(usageDetails).toBeVisible()
  await expect(usageDetails.getByText('All Codex models', { exact: true })).toBeVisible()
  await expect(usageDetails.getByText('GPT-5.3-Codex-Spark', { exact: true })).toBeVisible()
  await expect(usageDetails.getByText('5-hour window', { exact: true }).first()).toBeVisible()
  await expect(usageDetails.getByText('7-day window', { exact: true })).toBeVisible()
  await expect(usageDetails.getByText('12.5 credits', { exact: true })).toBeVisible()
  await expect(usageDetails.getByText('reset available', { exact: true })).toBeVisible()
  await usageDetails.getByRole('button', { name: 'Close usage details' }).click()
  await expect(usageDetails).toHaveCount(0)

  await displaySession.send('Emulation.setDeviceMetricsOverride', { width: 980, height: 760, deviceScaleFactor: 1, mobile: false })
  await window.waitForTimeout(150)
  const compactHomeLayout = await window.evaluate(() => {
    const rail = document.querySelector('.rail') as HTMLElement
    const teamPane = document.querySelector('.team-pane') as HTMLElement
    const railLabel = document.querySelector('.rail-label') as HTMLElement
    return {
      railWidth: Math.round(rail.getBoundingClientRect().width),
      teamPaneVisible: getComputedStyle(teamPane).display !== 'none',
      railLabelVisible: getComputedStyle(railLabel).display !== 'none'
    }
  })
  expect(compactHomeLayout.railWidth).toBe(72)
  expect(compactHomeLayout.teamPaneVisible).toBe(false)
  expect(compactHomeLayout.railLabelVisible).toBe(false)

  await window.getByLabel('Agents', { exact: true }).click()
  await expect(window.getByLabel('Message Atlas')).toBeVisible()
  expect(await window.locator('.team-pane').evaluate((pane) => getComputedStyle(pane).display)).toBe('flex')
  await displaySession.send('Emulation.setDeviceMetricsOverride', { width: 1420, height: 900, deviceScaleFactor: 1, mobile: false })
  await window.waitForTimeout(150)

  const composer = window.getByLabel('Message Atlas')
  const longResultUrl = `https://outlook.live.com/owa/?ItemID=${'A'.repeat(260)}&viewmodel=ReadMessageItem`
  const longTask = `Atlas should read all other agents and give me a detailed summary of everything accomplished today and this week, including every outstanding approval or item that needs my attention. Open result: ${longResultUrl}`
  await window.getByLabel('Attach images').click()
  await expect(window.getByText('test-image.png', { exact: true })).toBeVisible()
  await composer.fill(longTask)
  await window.getByLabel('Send').click()
  await expect(window.getByText('1 user-selected image attached to Atlas’s turn.')).toBeVisible()
  await expect(window.getByText(`FAKE_RESPONSE: ${longTask}`)).toBeVisible()
  const conversationLayout = await window.evaluate(() => {
    const body = document.querySelector('.conversation-body') as HTMLElement
    const scroller = document.querySelector('.message-scroll') as HTMLElement
    const inspector = document.querySelector('.inspector') as HTMLElement
    const card = Array.from(document.querySelectorAll('.agent-message .message-card')).at(-1) as HTMLElement
    const scrollerBounds = scroller.getBoundingClientRect()
    const inspectorBounds = inspector.getBoundingClientRect()
    const cardBounds = card.getBoundingClientRect()
    return {
      bodyContained: body.scrollWidth <= body.clientWidth,
      scrollerContained: scroller.scrollWidth <= scroller.clientWidth,
      scrollerStopsBeforeInspector: scrollerBounds.right <= inspectorBounds.left + 1,
      cardContained: cardBounds.left >= scrollerBounds.left && cardBounds.right <= scrollerBounds.right,
      cardWrapsLongTokens: getComputedStyle(card).overflowWrap === 'anywhere'
    }
  })
  expect(conversationLayout).toEqual({
    bodyContained: true,
    scrollerContained: true,
    scrollerStopsBeforeInspector: true,
    cardContained: true,
    cardWrapsLongTokens: true
  })

  await window.getByLabel('Home').click()
  const recentRun = window.getByRole('button', { name: `Open completed run: ${longTask}` })
  await expect(recentRun).toBeVisible()
  const recentLayout = await recentRun.evaluate((row) => {
    const panel = row.closest('.panel') as HTMLElement
    const title = row.querySelector('strong') as HTMLElement
    const rowBounds = row.getBoundingClientRect()
    const panelBounds = panel.getBoundingClientRect()
    const titleStyle = getComputedStyle(title)
    return {
      contained: rowBounds.right <= panelBounds.right && row.scrollWidth <= row.clientWidth,
      lineClamp: titleStyle.webkitLineClamp,
      whiteSpace: titleStyle.whiteSpace
    }
  })
  expect(recentLayout).toEqual({ contained: true, lineClamp: '3', whiteSpace: 'normal' })
  await recentRun.click()
  await expect(window.getByRole('heading', { name: 'Runs', exact: true })).toBeVisible()
  await window.getByLabel('Agents', { exact: true }).click()

  await composer.fill('REQUEST_APPROVAL')
  await window.getByLabel('Send').click()
  await window.getByLabel('Approvals', { exact: true }).click()
  await expect(window.getByText('Run a local command')).toBeVisible()
  await expect(window.getByText('Target resource')).toBeVisible()
  await window.getByLabel('Ask about approval').fill('Which local resource does this affect?')
  await window.getByRole('button', { name: 'Ask without approving' }).click()
  await expect(window.getByRole('heading', { name: 'Run a local command' })).toBeVisible()
  await window.getByRole('button', { name: 'Approve once' }).click()
  await window.getByLabel('Agents', { exact: true }).click()
  await expect(window.getByText(/approval=accept/)).toBeVisible()

  await window.getByLabel('Tools').click()
  await expect(window.getByRole('heading', { name: 'Outlook Email', exact: true })).toBeVisible()
  await expect(window.getByText('Choose an app by name')).toBeVisible()
  await expect(window.getByText('SplittBot never asks for or stores your password.')).toBeVisible()
  await expect(window.getByText('Microsoft Outlook Email is connected and ready in Codex')).toBeVisible()
  await window.getByRole('button', { name: 'Grant Outlook Email to Atlas' }).click()
  await expect(window.getByRole('button', { name: 'Revoke Outlook Email from Atlas' })).toBeVisible()
  await window.getByRole('button', { name: 'Manage connection' }).first().click()
  await expect(window.getByRole('status')).toContainText('Outlook Email opened in your browser')
  expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  await window.getByRole('button', { name: 'Dismiss browser message' }).click()
  await expect(window.getByRole('status')).toHaveCount(0)
  await expect(window.getByRole('heading', { name: 'Google Drive', exact: true })).toHaveCount(0)
  await window.getByLabel('Find an app').fill('Google Drive')
  await expect(window.getByRole('heading', { name: 'Google Drive', exact: true })).toBeVisible()
  await window.getByLabel('Find an app').fill('')
  await expect(window.getByLabel('Connector name')).toHaveCount(0)
  await window.getByRole('button', { name: 'Advanced MCP settings' }).click()
  await expect(window.getByRole('heading', { name: 'Demo Docs', exact: true })).toBeVisible()
  await expect(window.getByText('demo_docs', { exact: true })).toBeVisible()
  await window.getByRole('button', { name: 'Add custom MCP connector' }).click()
  await window.getByLabel('Connector name').fill('extra_docs')
  await window.getByLabel('HTTPS endpoint').fill('https://example.org/mcp')
  await window.getByRole('button', { name: 'Save custom connector' }).click()
  const extraConnector = window.locator('.integration-row').filter({ hasText: 'extra_docs' })
  await expect(extraConnector).toBeVisible()
  await expect(extraConnector.getByRole('heading', { name: 'Extra Docs', exact: true })).toBeVisible()
  await extraConnector.getByRole('button', { name: 'Edit' }).click()
  await window.getByLabel('HTTPS endpoint').fill('https://example.net/mcp')
  await window.getByRole('button', { name: 'Save changes' }).click()
  window.once('dialog', (dialog) => void dialog.accept())
  await extraConnector.getByRole('button', { name: 'Remove' }).click()
  await expect(window.locator('.integration-row').filter({ hasText: 'extra_docs' })).toHaveCount(0)
  await window.getByRole('button', { name: 'Add account identity' }).click()
  await window.getByLabel('Account label').fill('Work')
  await window.getByLabel('Login identifier').fill('work@example.com')
  await window.getByRole('button', { name: 'Create & authenticate' }).click()
  await expect(window.getByRole('heading', { name: 'Demo Docs · Work', exact: true })).toBeVisible()
  await window.getByRole('button', { name: 'Add account identity' }).click()
  await window.getByLabel('Account label').fill('Personal')
  await window.getByLabel('Login identifier').fill('personal@example.com')
  await window.getByRole('button', { name: 'Create & authenticate' }).click()
  await expect(window.getByRole('heading', { name: 'Demo Docs · Personal', exact: true })).toBeVisible()
  await window.getByRole('button', { name: /Skills ·/ }).click()
  await expect(window.getByRole('heading', { name: 'Fake Brief', exact: true })).toBeVisible()
  await expect(window.getByText('$fake-brief', { exact: true })).toBeVisible()
  await window.getByRole('button', { name: 'Approve review' }).click()

  await window.getByLabel('Agents', { exact: true }).click()
  await window.getByRole('button', { name: 'Edit agent' }).click()
  await window.getByLabel('Approved apps').fill('Preview')
  await window.getByRole('button', { name: 'Demo Docs', exact: true }).click()
  await window.getByRole('button', { name: 'Demo Docs · Work', exact: true }).click()
  await window.getByRole('button', { name: 'Fake Brief' }).click()
  await window.getByRole('button', { name: 'Save changes' }).click()

  await window.getByLabel('Routines').click()
  await window.getByRole('button', { name: 'New routine' }).click()
  await window.getByLabel('Reviewed skill').selectOption('/tmp/fake-brief/SKILL.md')
  await window.getByRole('button', { name: 'Create routine' }).click()
  await expect(window.getByRole('heading', { name: 'Morning brief' })).toBeVisible()
  await window.getByRole('button', { name: 'Run now' }).click()
  await window.getByLabel('Notifications').click()
  await expect(window.getByText('“Morning brief” completed.')).toBeVisible()

  await window.getByLabel('Computer').click()
  await expect(window.getByText('Accessibility')).toBeVisible()
  await expect(window.getByText('Screen Recording')).toBeVisible()
  await window.getByLabel('GUI step 2 milliseconds').fill('2000')
  await window.getByRole('button', { name: 'Send GUI plan to approvals' }).click()
  await window.getByLabel('Approvals', { exact: true }).click()
  await expect(window.getByRole('heading', { name: 'Control Preview with Atlas' })).toBeVisible()
  await window.getByRole('button', { name: 'Approve once' }).click()
  await window.getByLabel('Computer').click()
  await expect(window.getByRole('button', { name: 'Pause' })).toBeVisible()
  await window.getByRole('button', { name: 'Pause' }).click()
  await expect(window.getByRole('button', { name: 'Resume' })).toBeVisible()
  await window.getByRole('button', { name: 'Resume' }).click()
  await expect(window.getByAltText('Latest GUI verification evidence')).toBeVisible()
  await expect(window.locator('.live-view .status-pill')).toHaveText('Completed')

  await window.getByRole('button', { name: 'Send GUI plan to approvals' }).click()
  await window.getByLabel('Approvals', { exact: true }).click()
  await window.getByRole('button', { name: 'Approve once' }).click()
  await window.getByLabel('Computer').click()
  await expect(window.getByRole('button', { name: 'Take over' })).toBeVisible()
  await window.getByRole('button', { name: 'Take over' }).click()
  await expect(window.locator('.live-view .status-pill')).toHaveText('Takeover')

  window.once('dialog', (dialog) => void dialog.accept())
  await window.getByRole('button', { name: 'Emergency stop' }).click()
  await expect(window.getByText('Emergency stop is active')).toBeVisible()
  await window.getByRole('button', { name: 'Reset emergency stop' }).click()
  await expect(window.getByText('Immediately stop the active lane and cancel queued GUI work.')).toBeVisible()

  await window.getByLabel('Artifacts').click()
  await window.getByRole('button', { name: 'Export' }).first().click()
  await expect(window.getByText(`Exported to ${artifactPath}`)).toBeVisible()
  expect((await readFile(artifactPath, 'utf8')).length).toBeGreaterThan(20)

  await window.getByLabel('Routines').click()
  window.once('dialog', (dialog) => void dialog.accept())
  await window.getByRole('button', { name: 'Delete' }).click()
  await expect(window.getByRole('heading', { name: 'Morning brief' })).toHaveCount(0)

  await window.getByRole('button', { name: 'New agent' }).click()
  await window.getByLabel('Name').fill('Maya')
  await window.getByLabel('Role').fill('Researcher')
  await window.getByLabel('Working instructions').fill('Research approved sources and cite every claim. Ask @')
  await window.getByRole('listbox', { name: 'Agent mentions' }).getByRole('button', { name: /@Atlas/ }).click()
  await window.getByLabel('Model').selectOption('fake-codex-model')
  await window.getByLabel('AI effort').selectOption('high')
  await window.getByRole('button', { name: 'Avatar 🔬' }).click()
  await window.getByRole('button', { name: 'Outlook Email', exact: true }).click()
  await window.getByRole('button', { name: 'Demo Docs · Personal', exact: true }).click()
  await window.getByRole('button', { name: 'Add schedule' }).click()
  await window.getByLabel('Schedule title').fill('Maya morning research')
  await window.getByLabel('Schedule instructions').fill('Review approved sources and prepare a private research brief. Do not send or publish anything.')
  await window.getByLabel('Schedule time').fill('09:15')
  await window.getByRole('button', { name: 'Create agent' }).click()
  await expect(window.getByRole('heading', { name: 'Maya', exact: true })).toBeVisible()
  await expect(window.getByText('Maya morning research', { exact: true })).toBeVisible()
  await expect(window.locator('.conversation-header .avatar-emoji')).toHaveText('🔬')
  await window.getByLabel('Message Maya').fill('Prepare a team brief')
  await window.getByLabel('Send').click()
  await expect(window.getByText('Maya is collaborating with @Atlas. Each teammate keeps their own model, effort, workspace, and permissions.')).toBeVisible()
  await expect(window.getByText(/Complete the user's original task: Prepare a team brief/)).toBeVisible()
  await expect(window.getByText(/@Atlas reviewed Maya’s completed output:/)).toBeVisible()
  await window.getByRole('button', { name: /AT Atlas Chief of Staff/ }).click()
  await expect(window.getByText('@Maya shared a completed result for your review. You can analyze the shared text, but your app, connector, workspace, and write permissions have not changed.')).toBeVisible()
  await expect(window.getByText(/Review the completed result from @Maya/)).toBeVisible()

  await window.evaluate(() => {
    const style = document.createElement('style')
    style.id = 'agent-scroll-regression-fixture'
    style.textContent = '.message-scroll .message-row { min-height: 420px !important; }'
    document.head.append(style)
  })
  await window.getByRole('button', { name: /Maya Researcher/ }).click()
  const messageList = window.locator('[data-testid="message-list"]')
  await expect(messageList).toBeVisible()
  expect(await messageList.evaluate((list) => getComputedStyle(list).scrollBehavior)).toBe('auto')
  expect(await messageList.evaluate((list) => list.scrollHeight > list.clientHeight)).toBe(true)
  expect(await messageList.evaluate((list) => Math.round(list.scrollHeight - list.scrollTop - list.clientHeight))).toBeLessThanOrEqual(1)
  await window.evaluate(() => document.querySelector('#agent-scroll-regression-fixture')?.remove())

  await window.getByLabel('Workspaces').click()
  await window.getByLabel('Workspace name').fill('Research launch')
  await window.getByLabel('Workspace objective').fill('Prepare a cited launch brief with a clear owner.')
  await window.getByLabel('Workspace owner').selectOption({ label: 'Maya · Researcher' })
  await window.getByRole('button', { name: 'Create workspace' }).click()
  await expect(window.getByRole('heading', { name: 'Research launch' })).toBeVisible()
  await expect(window.getByText('Mentioned teammates only')).toBeVisible()
  await window.getByLabel('Workspace task').fill('@Atlas synthesize the evidence for this launch.')
  await window.getByRole('button', { name: 'Start task' }).click()
  await expect(window.getByText('@Atlas returned a contribution')).toBeVisible()
  await expect(window.getByText('@Maya completed the workspace task')).toBeVisible()
  window.once('dialog', (dialog) => void dialog.accept())
  await window.getByRole('button', { name: 'Archive', exact: true }).click()

  await window.getByLabel('Memory').click()
  await window.getByLabel('Memory agent').selectOption({ label: 'Maya' })
  await window.getByLabel('New memory note').fill('Use primary sources and separate facts from assumptions.')
  await window.getByRole('button', { name: 'Add note' }).click()
  await expect(window.getByText('Use primary sources and separate facts from assumptions.')).toBeVisible()
  await window.getByLabel('Codex memory').selectOption('disabled')
  await window.getByLabel('Memory retention days').fill('30')
  await window.getByRole('button', { name: 'Save policy' }).click()
  await window.getByRole('button', { name: 'Export memory' }).click()
  await expect(window.getByText(`Exported to ${memoryExportPath}`)).toBeVisible()
  expect(await readFile(memoryExportPath, 'utf8')).toContain('Use primary sources')
  await window.getByLabel('Agents', { exact: true }).click()
  await window.getByRole('button', { name: /Maya Researcher/ }).click()
  await window.getByLabel('Message Maya').fill('Check explicit memory context')
  await window.getByLabel('Send').click()
  // Atlas may already have quoted this response by the time the assertion runs.
  // Match the original agent result, not the collaborator's review of it.
  await expect(window.getByText(/^FAKE_RESPONSE:.*Complete the user's original task: Check explicit memory context/s)).toBeVisible()

  await window.getByLabel('Settings').click()
  await window.getByRole('button', { name: 'Check runtime & permissions' }).click()
  await expect(window.getByText('Deterministic GUI adapter results are not accepted as packaged permission evidence.')).toBeVisible()
  await window.getByRole('button', { name: 'Start sleep/wake check' }).click()
  await expect(window.getByText(/real Mac sleep\/wake cycle/)).toBeVisible()
  await emulateAppearance(window, { colorScheme: 'dark', reducedMotion: 'reduce' })
  const darkAcceptance = await window.locator('.acceptance-list article').first().evaluate((row) => ({
    background: getComputedStyle(row).backgroundColor,
    text: getComputedStyle(row.querySelector('strong') as HTMLElement).color
  }))
  expect(darkAcceptance.background).not.toBe('rgb(250, 248, 244)')
  expect(darkAcceptance.text).not.toBe(darkAcceptance.background)
  await emulateAppearance(window, { colorScheme: 'light', reducedMotion: 'reduce' })

  await window.getByLabel('Agents', { exact: true }).click()
  await window.getByRole('button', { name: /Maya Researcher/ }).click()
  await window.getByRole('button', { name: 'Edit agent' }).click()
  window.once('dialog', (dialog) => void dialog.accept())
  await window.getByRole('button', { name: 'Archive agent' }).click()
  await expect(window.getByRole('button', { name: /Maya Researcher/ })).toHaveCount(0)

  await window.getByLabel('Settings').click()
  await window.getByRole('button', { name: 'Create backup' }).click()
  await expect(window.getByText(`Backup created: ${backupPath}`)).toBeVisible()
  expect((await readFile(backupPath)).subarray(0, 16).toString('utf8')).toBe('SQLite format 3\0')

  await application.close()
  application = await electron.launch({ args: [resolve('out/main/index.js')], env: environment })
  window = await application.firstWindow()
  await window.getByLabel('Agents', { exact: true }).click()
  await window.getByRole('button', { name: /AT Atlas Chief of Staff/ }).click()
  await window.getByLabel('Message Atlas').fill('After restart')
  await window.getByLabel('Send').click()
  await expect(window.getByText(/After restart/)).toBeVisible({ timeout: 15_000 })
  await application.close()

  const protocolLog = await readFile(fakeLog, 'utf8')
  const currentVersion = (JSON.parse(await readFile(resolve('package.json'), 'utf8')) as { version: string }).version
  expect(protocolLog).toContain(`"clientInfo":{"name":"splittbot","title":"SplittBot","version":"${currentVersion}"}`)
  expect(protocolLog).toContain('"capabilities":{"experimentalApi":true}')
  expect(protocolLog).toContain('"method":"thread/resume"')
  expect(protocolLog).toContain('"method":"turn/steer"')
  expect(protocolLog).toContain('"method":"thread/memoryMode/set"')
  expect(protocolLog).toContain('Use primary sources and separate facts from assumptions.')
  expect(protocolLog).toContain('Your configured Codex model is fake-codex-model.')
  expect(protocolLog).toContain('Your configured AI reasoning effort is high.')
  expect(protocolLog).toContain('"method":"model/list"')
  expect(protocolLog).toContain('"method":"app/list"')
  expect(protocolLog).toContain('"method":"app/installed"')
  expect(protocolLog).toContain('"effort":"high"')
  expect(protocolLog).toContain(`"type":"localImage","path":"${canonicalAttachmentPath}","detail":"auto"`)
  expect(protocolLog).toContain('"type":"skill","name":"fake-brief","path":"/tmp/fake-brief/SKILL.md"')
  expect(protocolLog).toContain('You are collaborating with @Maya')
  expect(protocolLog).toContain('SplittBot collaboration context:')
  expect(protocolLog).toContain('Review the completed result from @Maya')
  const protocolMessages = protocolLog.trim().split('\n').map((line) => JSON.parse(line) as { method?: string; params?: Record<string, any> })
  const accountReads = protocolMessages.filter((message) => message.method === 'account/read')
  expect(accountReads.length).toBeGreaterThan(0)
  expect(accountReads.every((message) => message.params?.refreshToken === false)).toBe(true)
  expect(protocolMessages.filter((message) => message.method === 'account/rateLimits/read').length).toBeGreaterThan(1)
  const oauthNames = protocolMessages.filter((message) => message.method === 'mcpServer/oauth/login').map((message) => String(message.params?.name ?? ''))
  expect(oauthNames).toHaveLength(2)
  expect(new Set(oauthNames).size).toBe(2)
  const threadConfigs = protocolMessages.filter((message) => ['thread/start', 'thread/resume'].includes(message.method ?? '')).map((message) => message.params?.config?.mcp_servers as Record<string, { enabled?: boolean }> | undefined).filter(Boolean)
  expect(threadConfigs.every((config) => config?.codex_apps?.enabled === false)).toBe(true)
  expect(threadConfigs.some((config) => config?.[oauthNames[0]!]?.enabled === true && config?.[oauthNames[1]!]?.enabled === false)).toBe(true)
  expect(threadConfigs.some((config) => config?.[oauthNames[0]!]?.enabled === false && config?.[oauthNames[1]!]?.enabled === true)).toBe(true)
  const appConfigs = protocolMessages.filter((message) => ['thread/start', 'thread/resume'].includes(message.method ?? '')).map((message) => message.params?.config?.apps as Record<string, { enabled?: boolean }> | undefined).filter(Boolean)
  expect(appConfigs.some((config) => config?._default?.enabled === false && config?.connector_outlook_email_fake?.enabled === true)).toBe(true)
  const appStartConfigs = protocolMessages.filter((message) => message.method === 'thread/start').map((message) => message.params?.config?.apps as Record<string, { enabled?: boolean }> | undefined).filter(Boolean)
  expect(appStartConfigs.some((config) => config?._default?.enabled === false && config?.connector_outlook_email_fake?.enabled === true)).toBe(true)
  const appTurns = protocolMessages.filter((message) => message.method === 'turn/start' && Array.isArray(message.params?.input) && message.params.input.some((item: Record<string, unknown>) => item.type === 'mention'))
  expect(appTurns.some((message) => message.params?.input?.some((item: Record<string, unknown>) => item.type === 'mention' && item.name === 'Microsoft Outlook Email' && item.path === 'app://connector_outlook_email_fake'))).toBe(true)
  expect(appTurns.some((message) => String(message.params?.input?.[0]?.text ?? '').startsWith('$outlook-email\n'))).toBe(true)
})

test('keeps drafts and attachments with their agent and reopens from the Dock', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-drafts-'))
  const attachmentPath = join(dataDirectory, 'draft-image.png')
  await writeFile(attachmentPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XG8QAAAAAElFTkSuQmCC', 'base64'))
  const application = await electron.launch({
    args: [resolve('out/main/index.js')], env: {
      ...process.env, SPLITTBOT_DATA_DIR: dataDirectory, SPLITTBOT_TEST_MODE: '1', SPLITTBOT_DEFAULT_CWD: process.cwd(),
      SPLITTBOT_CODEX_COMMAND: process.execPath, SPLITTBOT_CODEX_ARGS_JSON: JSON.stringify([resolve('tests/fixtures/fake-app-server.mjs')]),
      SPLITTBOT_TEST_ATTACHMENT_PATH: attachmentPath
    }
  })
  try {
    let window = await application.firstWindow()
    await expect(window.getByText('Good to see you.')).toBeVisible()
    await window.evaluate(async () => {
      const snapshot = await globalThis.window.splittbot.bootstrap()
      await globalThis.window.splittbot.agents.create({ ...snapshot.agents[0]!, name: 'Maya', role: 'Researcher', collaboratorIds: [] })
    })
    await window.getByLabel('Agents', { exact: true }).click()
    await window.getByLabel('Message Atlas').fill('Atlas draft, not for Maya')
    await window.getByLabel('Attach images').click()
    await expect(window.getByText('draft-image.png', { exact: true })).toBeVisible()
    await window.locator('.agent-list button').filter({ hasText: 'Maya' }).click()
    await expect(window.getByLabel('Message Maya')).toHaveValue('')
    await expect(window.getByText('draft-image.png', { exact: true })).toHaveCount(0)
    await window.getByLabel('Message Maya').fill('Maya draft, not for Atlas')
    await window.locator('.agent-list button').filter({ hasText: 'Atlas' }).click()
    await expect(window.getByLabel('Message Atlas')).toHaveValue('Atlas draft, not for Maya')
    await expect(window.getByText('draft-image.png', { exact: true })).toBeVisible()
    await window.locator('.agent-list button').filter({ hasText: 'Maya' }).click()
    await expect(window.getByLabel('Message Maya')).toHaveValue('Maya draft, not for Atlas')
    await window.screenshot({ path: test.info().outputPath('agent-draft-isolation.png') })

    await window.close()
    const reopened = application.waitForEvent('window')
    await application.evaluate(({ app }) => { app.emit('activate') })
    window = await reopened
    await expect(window.getByText('Good to see you.')).toBeVisible()
    // A second activation must focus the same window, not register duplicate IPC.
    await application.evaluate(({ app }) => { app.emit('activate') })
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
    await window.getByLabel('Agents', { exact: true }).click()
    await expect(window.getByLabel('Message Atlas')).toBeVisible()
  } finally { await application.close() }
})

test('Action Center keeps agent decisions durable, de-duplicates reruns, and starts safe AI next steps', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-actions-'))
  const application = await electron.launch({
    args: [resolve('out/main/index.js')],
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
  await window.getByLabel('Agents', { exact: true }).click()
  await window.getByLabel('Message Atlas').fill('ACTION_OUTPUT')
  await window.getByLabel('Send').click()
  await expect(window.getByText('Decisions still needed: whether the invoice is valid and should be paid, whether recent security activity was authorized, and whether to submit the settlement claim.')).toBeVisible()

  await window.getByLabel('Actions').click()
  await expect(window.getByRole('heading', { name: 'Action Center' })).toBeVisible()
  await expect(window.getByRole('button', { name: /Decide whether the invoice is valid and should be paid/ })).toHaveCount(1)
  await expect(window.getByRole('button', { name: /Decide whether recent security activity was authorized/ })).toHaveCount(1)
  await expect(window.getByRole('button', { name: /Decide whether to submit the settlement claim/ })).toHaveCount(1)

  await window.getByLabel('Agents', { exact: true }).click()
  await window.getByLabel('Message Atlas').fill('ACTION_OUTPUT')
  await window.getByLabel('Send').click()
  await expect(window.getByText('Decisions still needed:', { exact: false })).toHaveCount(2)
  await window.getByLabel('Actions').click()
  await expect(window.getByRole('button', { name: /Decide whether the invoice is valid and should be paid/ })).toHaveCount(1)

  await window.getByRole('button', { name: /Decide whether the invoice is valid and should be paid/ }).click()
  await expect(window.getByRole('heading', { name: 'Decide whether the invoice is valid and should be paid' })).toBeVisible()
  await window.getByRole('button', { name: /Ask Atlas/ }).click()
  await expect(window.getByText('Latest agent guidance')).toBeVisible()
  await expect(window.locator('.action-result')).toContainText('Give 2-4 concrete options')
  await expect(window.locator('.action-detail .status-pill')).toHaveText('Next')

  await window.getByLabel('Action resolution').fill('Verified against the purchase record.')
  await window.getByRole('button', { name: 'Mark done' }).click()
  await expect(window.locator('.action-list')).not.toContainText('Decide whether the invoice is valid and should be paid')
  await window.getByRole('button', { name: 'Closed', exact: true }).click()
  await expect(window.locator('.action-detail .status-pill')).toHaveText('Done')
  await window.getByLabel('Home').click()
  await expect(window.locator('.metric').filter({ hasText: 'Needs attention' })).toContainText('2')
  await application.close()
})

test('Action Center repairs category-count cards into explanatory mailbox actions', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-action-repair-'))
  const store = await SqliteStore.open(join(dataDirectory, 'splittbot.sqlite'))
  const agent = await store.createAgent({
    name: 'Email Cleanup', role: 'Mailbox triage', instructions: 'Triage mail read-only.', color: '#3f71c7',
    model: null, reasoningEffort: null, avatar: { type: 'initials', value: null }, collaboratorIds: [], cwd: process.cwd(), accessMode: 'readOnly',
    grants: { readableRoots: [process.cwd()], writableRoots: [], allowedCommands: [], allowedApps: [], allowedConnectedApps: [], allowedConnectors: [], allowedConnectorAccounts: [], allowedSkillPaths: [], allowedShortcuts: [], networkAccess: false }
  })
  const output = [
    '### Top three actions',
    '',
    '1. **Review the sample vendor invoice.** Confirm the project owner within five days before renewing the test subscription. [Open notice](https://example.com/sample-message)',
    '2. **Review the sample security notice.** Confirm whether the demo workspace access was authorized.',
    '3. **Prepare for tomorrow’s planning meeting.** Complete the sample agenda before the meeting.',
    '',
    '### Today’s totals',
    '',
    '- Urgent today: **1**',
    '- Decision needed: **4**',
    '- Quick reply: **0**',
    '- Delegate/follow up: **4**',
    '- FYI/archive: **33**'
  ].join('\n')
  const run = await store.createRun(agent.id, 'Run today’s mailbox cleanup')
  await store.updateRun(run.id, { status: 'completed', output, completedAt: new Date().toISOString() })
  for (const [index, value] of ['Quick reply: **0', 'Delegate/follow up: **4', 'FYI/archive: **33'].entries()) {
    const now = new Date(Date.now() + index).toISOString()
    await store.createAction({
      title: `Decide whether ${value}`, summary: value, type: 'decision', status: 'inbox', priority: 'normal', ownerAgentId: null,
      sourceAgentId: agent.id, sourceRunId: run.id, sourceRoutineId: null, sourceAccountId: null, workspaceId: null, dueAt: null,
      firstSeenAt: now, lastSeenAt: now, fingerprint: `malformed-${index}`, evidence: [{ runId: run.id, excerpt: value, observedAt: now }],
      resolution: null, createdBy: 'agent'
    })
  }
  store.close()

  const application = await electron.launch({
    args: [resolve('out/main/index.js')],
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
  await window.getByLabel('Actions').click()
  await expect(window.getByRole('button', { name: /Review the sample vendor invoice/ })).toBeVisible()
  await expect(window.getByRole('button', { name: /Review the sample security notice/ })).toBeVisible()
  await expect(window.getByRole('button', { name: /Prepare for tomorrow’s planning meeting/ })).toBeVisible()
  await expect(window.getByRole('button', { name: /Delegate\/follow up: 4/ })).toHaveCount(0)
  await window.getByRole('button', { name: /Review the sample vendor invoice/ }).click()
  await expect(window.getByText('What you need to action')).toBeVisible()
  await expect(window.locator('.action-brief')).toContainText('Confirm the project owner within five days')
  await expect(window.locator('.action-brief')).not.toContainText('https://')
  await application.close()
})

test('Codex usage footer fails closed when the runtime does not expose account limits', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-usage-unavailable-'))
  const application = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: {
      ...process.env,
      SPLITTBOT_DATA_DIR: dataDirectory,
      SPLITTBOT_TEST_MODE: '1',
      SPLITTBOT_DEFAULT_CWD: process.cwd(),
      SPLITTBOT_CODEX_COMMAND: process.execPath,
      SPLITTBOT_CODEX_ARGS_JSON: JSON.stringify([resolve('tests/fixtures/fake-app-server.mjs')]),
      SPLITTBOT_FAKE_USAGE_UNAVAILABLE: '1'
    }
  })
  const window = await application.firstWindow()
  const usageButton = window.getByRole('button', { name: 'Codex connected, Plus plan, usage unavailable' })
  await setDesktopViewport(window)
  await expect(usageButton).toBeVisible()
  await expect(usageButton).toBeDisabled()
  await expect(usageButton.getByText('Usage unavailable', { exact: true })).toBeVisible()
  await application.close()
})

test('keeps Codex import out of startup and imports only from Settings without duplicating schedules', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-imports-'))
  const fakeLog = join(dataDirectory, 'fake.jsonl')
  const importHome = join(dataDirectory, 'source-codex')
  const automationDirectory = join(importHome, 'automations', 'daily-imported-brief')
  await mkdir(automationDirectory, { recursive: true })
  await writeFile(join(automationDirectory, 'automation.toml'), [
    'version = 1',
    'id = "daily-imported-brief"',
    'name = "Daily imported brief"',
    'prompt = "Prepare a concise source-backed brief. Do not send or change anything."',
    'status = "ACTIVE"',
    'rrule = "FREQ=DAILY;BYHOUR=8;BYMINUTE=15"',
    'target_thread_id = "thr_import_marketing"',
    `updated_at = ${Date.now()}`
  ].join('\n'))
  const application = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: {
      ...process.env,
      SPLITTBOT_DATA_DIR: dataDirectory,
      SPLITTBOT_TEST_MODE: '1',
      SPLITTBOT_DEFAULT_CWD: process.cwd(),
      SPLITTBOT_CODEX_COMMAND: process.execPath,
      SPLITTBOT_CODEX_ARGS_JSON: JSON.stringify([resolve('tests/fixtures/fake-app-server.mjs')]),
      SPLITTBOT_FAKE_LOG: fakeLog,
      SPLITTBOT_IMPORT_CODEX_HOME: importHome,
      SPLITTBOT_FAKE_IMPORTS: '1',
      SPLITTBOT_FAKE_IMPORT_CWD: process.cwd()
    }
  })
  const window = await application.firstWindow()
  const picker = window.getByRole('dialog', { name: 'Import from ChatGPT and Codex' })
  await expect(window.getByText('Good to see you.')).toBeVisible()
  await window.waitForTimeout(250)
  await expect(picker).toHaveCount(0)
  await expect.poll(async () => {
    const entries = (await readFile(fakeLog, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as { method?: string })
    return entries.filter((entry) => entry.method === 'thread/list').length
  }).toBe(0)

  await window.getByLabel('Settings').click()
  await window.getByRole('button', { name: 'Import existing agents & tasks' }).click()
  await expect(picker).toBeVisible()
  await expect(picker.getByRole('heading', { name: 'What should SplittBot import?' })).toBeVisible()
  await expect(picker.getByText('Marketing Agent', { exact: true })).toBeVisible()
  await expect(picker.getByText('Daily imported brief', { exact: true })).toBeVisible()
  await expect(picker.getByText(/does not create another schedule or duplicate a run/)).toBeVisible()

  await picker.getByLabel('Import Marketing Agent').check()
  await picker.getByLabel('Import Daily imported brief').check()
  await picker.getByRole('button', { name: 'Import & monitor 2' }).click()
  await expect(picker).toHaveCount(0)
  await window.getByLabel('Agents', { exact: true }).click()
  await expect(window.getByRole('button', { name: /Marketing Agent Imported Codex agent/ })).toBeVisible()

  await window.getByLabel('Routines').click()
  await expect(window.getByRole('heading', { name: 'Monitored Codex tasks' })).toBeVisible()
  await expect(window.getByText('Daily imported brief', { exact: true })).toBeVisible()
  await expect(window.getByText(/Runs remain owned by Codex/)).toBeVisible()
  await expect(window.locator('.routine-card').filter({ hasText: 'Daily imported brief' })).toHaveCount(0)

  await window.getByLabel('Settings').click()
  await expect(window.getByRole('heading', { name: '1 linked Bot · 1 monitored task' })).toBeVisible()
  await application.close()
})
