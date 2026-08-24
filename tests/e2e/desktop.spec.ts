import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import packageMetadata from '../../package.json'

test('Phase 0-5 desktop flow persists agents, gates tools, attaches images, and safely controls one GUI lane', async () => {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'splittbot-e2e-'))
  const fakeLog = join(dataDirectory, 'fake.jsonl')
  const backupPath = join(dataDirectory, 'phase-4-backup.sqlite')
  const artifactPath = join(dataDirectory, 'gui-verification.md')
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
    SPLITTBOT_TEST_ATTACHMENT_PATH: attachmentPath
  }

  let application = await electron.launch({ args: [resolve('out/main/index.js')], env: environment })
  let window = await application.firstWindow()
  await expect(window.getByText('Good to see you.')).toBeVisible()
  expect(await window.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe('undefined')

  await window.getByLabel('Agents').click()
  const composer = window.getByLabel('Message Atlas')
  await window.getByLabel('Attach images').click()
  await expect(window.getByText('test-image.png', { exact: true })).toBeVisible()
  await composer.fill('Hello from E2E')
  await window.getByLabel('Send').click()
  await expect(window.getByText('1 user-selected image attached to Atlas’s turn.')).toBeVisible()
  await expect(window.getByText('FAKE_RESPONSE: Hello from E2E')).toBeVisible()

  await composer.fill('REQUEST_APPROVAL')
  await window.getByLabel('Send').click()
  await window.getByLabel('Approvals').click()
  await expect(window.getByText('Run a local command')).toBeVisible()
  await window.getByRole('button', { name: 'Approve once' }).click()
  await window.getByLabel('Agents').click()
  await expect(window.getByText(/approval=accept/)).toBeVisible()

  await window.getByLabel('Tools').click()
  await expect(window.getByText('demo_docs', { exact: true })).toBeVisible()
  await window.getByRole('button', { name: /Skills ·/ }).click()
  await expect(window.getByRole('heading', { name: 'Fake Brief', exact: true })).toBeVisible()
  await expect(window.getByText('$fake-brief', { exact: true })).toBeVisible()
  await window.getByRole('button', { name: 'Approve review' }).click()

  await window.getByLabel('Agents').click()
  await window.getByRole('button', { name: 'Edit agent' }).click()
  await window.getByLabel('Approved apps').fill('Preview')
  await window.getByRole('button', { name: 'demo_docs' }).click()
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
  await window.getByRole('button', { name: 'Create agent' }).click()
  await expect(window.getByRole('heading', { name: 'Maya', exact: true })).toBeVisible()
  await expect(window.locator('.conversation-header .avatar-emoji')).toHaveText('🔬')
  await window.getByLabel('Message Maya').fill('Prepare a team brief')
  await window.getByLabel('Send').click()
  await expect(window.getByText('Maya is collaborating with @Atlas. Each teammate keeps their own model, effort, workspace, and permissions.')).toBeVisible()
  await expect(window.getByText(/FAKE_RESPONSE: Complete the user's original task: Prepare a team brief/)).toBeVisible()
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
  await expect(window.getByText('FAKE_RESPONSE: After restart')).toBeVisible()
  await application.close()

  const protocolLog = await readFile(fakeLog, 'utf8')
  expect(protocolLog).toContain(`"clientInfo":{"name":"splittbot","title":"SplittBot","version":"${packageMetadata.version}"}`)
  expect(protocolLog).toContain('"method":"thread/resume"')
  expect(protocolLog).toContain('"method":"model/list"')
  expect(protocolLog).toContain('"effort":"high"')
  expect(protocolLog).toContain(`"type":"localImage","path":"${canonicalAttachmentPath}","detail":"auto"`)
  expect(protocolLog).toContain('"type":"skill","name":"fake-brief","path":"/tmp/fake-brief/SKILL.md"')
  expect(protocolLog).toContain('You are collaborating with @Maya')
})
