import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

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
  expect(wideLayout.teamPaneVisible).toBe(true)
  expect(wideLayout.railLabelVisible).toBe(true)
  expect(wideLayout.railBackground).not.toBe(wideLayout.mainBackground)
  expect(wideLayout.panelMaterial).toBe('none')
  expect(wideLayout.fontFamily.toLowerCase()).not.toContain('georgia')

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

  await window.getByLabel('Agents').click()
  await expect(window.getByLabel('Message Atlas')).toBeVisible()
  expect(await window.locator('.team-pane').evaluate((pane) => getComputedStyle(pane).display)).toBe('flex')
  await displaySession.send('Emulation.setDeviceMetricsOverride', { width: 1420, height: 900, deviceScaleFactor: 1, mobile: false })
  await window.waitForTimeout(150)

  const composer = window.getByLabel('Message Atlas')
  const longTask = 'Atlas should read all other agents and give me a detailed summary of everything accomplished today and this week, including every outstanding approval or item that needs my attention.'
  await window.getByLabel('Attach images').click()
  await expect(window.getByText('test-image.png', { exact: true })).toBeVisible()
  await composer.fill(longTask)
  await window.getByLabel('Send').click()
  await expect(window.getByText('1 user-selected image attached to Atlas’s turn.')).toBeVisible()
  await expect(window.getByText(`FAKE_RESPONSE: ${longTask}`)).toBeVisible()

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
  expect(recentLayout).toEqual({ contained: true, lineClamp: '2', whiteSpace: 'normal' })
  await recentRun.click()
  await expect(window.getByRole('heading', { name: 'Runs', exact: true })).toBeVisible()
  await window.getByLabel('Agents').click()

  await composer.fill('REQUEST_APPROVAL')
  await window.getByLabel('Send').click()
  await window.getByLabel('Approvals').click()
  await expect(window.getByText('Run a local command')).toBeVisible()
  await expect(window.getByText('Target resource')).toBeVisible()
  await window.getByLabel('Ask about approval').fill('Which local resource does this affect?')
  await window.getByRole('button', { name: 'Ask without approving' }).click()
  await expect(window.getByRole('heading', { name: 'Run a local command' })).toBeVisible()
  await window.getByRole('button', { name: 'Approve once' }).click()
  await window.getByLabel('Agents').click()
  await expect(window.getByText(/approval=accept/)).toBeVisible()

  await window.getByLabel('Tools').click()
  await expect(window.getByRole('heading', { name: 'Demo Docs', exact: true })).toBeVisible()
  await expect(window.getByText('demo_docs', { exact: true })).toBeVisible()
  await window.getByRole('button', { name: 'Add connector' }).click()
  await window.getByLabel('Connector name').fill('extra_docs')
  await window.getByLabel('HTTPS endpoint').fill('https://example.org/mcp')
  await window.getByRole('button', { name: 'Save connector' }).click()
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

  await window.getByLabel('Agents').click()
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
  await window.getByLabel('Approvals').click()
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
  await window.getByLabel('Approvals').click()
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
  await window.getByRole('button', { name: 'Demo Docs · Personal', exact: true }).click()
  await window.getByRole('button', { name: 'Create agent' }).click()
  await expect(window.getByRole('heading', { name: 'Maya', exact: true })).toBeVisible()
  await expect(window.locator('.conversation-header .avatar-emoji')).toHaveText('🔬')
  await window.getByLabel('Message Maya').fill('Prepare a team brief')
  await window.getByLabel('Send').click()
  await expect(window.getByText('Maya is collaborating with @Atlas. Each teammate keeps their own model, effort, workspace, and permissions.')).toBeVisible()
  await expect(window.getByText(/FAKE_RESPONSE: Complete the user's original task: Prepare a team brief/)).toBeVisible()

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
  await window.getByLabel('Agents').click()
  await window.getByRole('button', { name: /Maya Researcher/ }).click()
  await window.getByLabel('Message Maya').fill('Check explicit memory context')
  await window.getByLabel('Send').click()
  await expect(window.getByText(/FAKE_RESPONSE: Complete the user's original task: Check explicit memory context/)).toBeVisible()

  await window.getByLabel('Settings').click()
  await window.getByRole('button', { name: 'Check runtime & permissions' }).click()
  await expect(window.getByText('Deterministic GUI adapter results are not accepted as packaged permission evidence.')).toBeVisible()
  await window.getByRole('button', { name: 'Exercise catch-up path' }).click()
  await expect(window.getByText(/real Mac sleep\/wake cycle/)).toBeVisible()
  await window.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const darkAcceptance = await window.locator('.acceptance-list article').first().evaluate((row) => ({
    background: getComputedStyle(row).backgroundColor,
    text: getComputedStyle(row.querySelector('strong') as HTMLElement).color
  }))
  expect(darkAcceptance.background).not.toBe('rgb(250, 248, 244)')
  expect(darkAcceptance.text).not.toBe(darkAcceptance.background)
  await window.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })

  await window.getByLabel('Agents').click()
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
  await window.getByLabel('Agents').click()
  await window.getByRole('button', { name: /AT Atlas Chief of Staff/ }).click()
  await window.getByLabel('Message Atlas').fill('After restart')
  await window.getByLabel('Send').click()
  await expect(window.getByText('FAKE_RESPONSE: After restart')).toBeVisible({ timeout: 15_000 })
  await application.close()

  const protocolLog = await readFile(fakeLog, 'utf8')
  const currentVersion = (JSON.parse(await readFile(resolve('package.json'), 'utf8')) as { version: string }).version
  expect(protocolLog).toContain(`"clientInfo":{"name":"splittbot","title":"SplittBot","version":"${currentVersion}"}`)
  expect(protocolLog).toContain('"method":"thread/resume"')
  expect(protocolLog).toContain('"method":"turn/steer"')
  expect(protocolLog).toContain('"method":"thread/memoryMode/set"')
  expect(protocolLog).toContain('Use primary sources and separate facts from assumptions.')
  expect(protocolLog).toContain('"method":"model/list"')
  expect(protocolLog).toContain('"effort":"high"')
  expect(protocolLog).toContain(`"type":"localImage","path":"${canonicalAttachmentPath}","detail":"auto"`)
  expect(protocolLog).toContain('"type":"skill","name":"fake-brief","path":"/tmp/fake-brief/SKILL.md"')
  expect(protocolLog).toContain('You are collaborating with @Maya')
  const protocolMessages = protocolLog.trim().split('\n').map((line) => JSON.parse(line) as { method?: string; params?: Record<string, any> })
  const oauthNames = protocolMessages.filter((message) => message.method === 'mcpServer/oauth/login').map((message) => String(message.params?.name ?? ''))
  expect(oauthNames).toHaveLength(2)
  expect(new Set(oauthNames).size).toBe(2)
  const threadConfigs = protocolMessages.filter((message) => ['thread/start', 'thread/resume'].includes(message.method ?? '')).map((message) => message.params?.config?.mcp_servers as Record<string, { enabled?: boolean }> | undefined).filter(Boolean)
  expect(threadConfigs.some((config) => config?.[oauthNames[0]!]?.enabled === true && config?.[oauthNames[1]!]?.enabled === false)).toBe(true)
  expect(threadConfigs.some((config) => config?.[oauthNames[0]!]?.enabled === false && config?.[oauthNames[1]!]?.enabled === true)).toBe(true)
})
