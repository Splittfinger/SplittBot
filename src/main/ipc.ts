import { dirname, join } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { app, dialog, ipcMain, shell } from 'electron'
import { z } from 'zod'
import type { CodexService } from './services/codex-service'
import { avatarImageMime, MAX_AVATAR_BYTES } from './services/avatar-image'
import { MAX_CHAT_IMAGES, validateChatImagePath, type ResolvedChatImage } from './services/chat-attachments'
import { writePrivateFile } from './services/data-recovery'
import { revealFile } from './services/reveal-file'

const grantsSchema = z.object({
  readableRoots: z.array(z.string()),
  writableRoots: z.array(z.string()),
  allowedCommands: z.array(z.string()),
  allowedApps: z.array(z.string()),
  allowedConnectedApps: z.array(z.string().min(1).max(200)),
  allowedConnectors: z.array(z.string().min(1).max(120)),
  allowedConnectorAccounts: z.array(z.string().uuid()),
  allowedSkillPaths: z.array(z.string().startsWith('/')),
  allowedShortcuts: z.array(z.string().min(1).max(180)),
  networkAccess: z.boolean()
})

const avatarSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('initials'), value: z.null() }),
  z.object({ type: z.literal('emoji'), value: z.string().trim().min(1).max(16) }),
  z.object({ type: z.literal('image'), value: z.string().startsWith('data:image/').max(7_000_000) })
])

const agentInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  role: z.string().trim().min(1).max(120),
  instructions: z.string().trim().min(1).max(12_000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  model: z.string().trim().max(120).nullable().optional(),
  reasoningEffort: z.string().trim().max(40).nullable().optional(),
  avatar: avatarSchema,
  collaboratorIds: z.array(z.string().uuid()).max(50),
  cwd: z.string().trim().min(1),
  accessMode: z.enum(['readOnly', 'workspaceWrite']),
  grants: grantsSchema
})

const idSchema = z.string().uuid()
const connectorNameSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{1,60}$/)
const connectorInputSchema = z.discriminatedUnion('transport', [
  z.object({ name: connectorNameSchema, transport: z.literal('stdio'), command: z.string().trim().startsWith('/').max(500), args: z.array(z.string().max(2_000)).max(50) }),
  z.object({ name: connectorNameSchema, transport: z.literal('streamableHttp'), url: z.string().url().refine((value) => new URL(value).protocol === 'https:', 'Connector URLs must use HTTPS.') })
])
const connectorAccountInputSchema = z.object({
  connectorName: connectorNameSchema,
  label: z.string().trim().min(1).max(80),
  accountIdentifier: z.string().trim().max(254).nullable().optional()
})
const scheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interval'), intervalMinutes: z.number().int().min(1).max(43_200), stopAfterDate: z.iso.date().optional() }),
  z.object({ kind: z.literal('daily'), timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7), stopAfterDate: z.iso.date().optional() })
])
const routineInputSchema = z.object({
  agentId: idSchema,
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(100_000),
  schedule: scheduleSchema,
  catchUpPolicy: z.enum(['skip', 'runOnce']),
  maxRetries: z.number().int().min(0).max(3),
  retryDelayMinutes: z.number().int().min(1).max(1_440),
  notifyPolicy: z.enum(['always', 'failure', 'never']),
  skillPath: z.string().startsWith('/').nullable().optional()
})
const workspaceInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  objective: z.string().trim().min(1).max(2_000),
  currentOwnerAgentId: idSchema,
  memberIds: z.array(idSchema).min(1).max(50),
  autoCoordinate: z.boolean()
})
const actionTypeSchema = z.enum(['decision', 'task', 'followUp', 'risk'])
const actionStatusSchema = z.enum(['inbox', 'next', 'waiting', 'scheduled', 'blocked', 'done', 'dismissed'])
const actionPrioritySchema = z.enum(['urgent', 'high', 'normal', 'low'])
const actionCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2_000),
  type: actionTypeSchema,
  priority: actionPrioritySchema,
  ownerAgentId: idSchema.nullable().optional(),
  sourceAgentId: idSchema,
  sourceRunId: idSchema.nullable().optional(),
  workspaceId: idSchema.nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  evidence: z.string().trim().max(2_000).nullable().optional()
})
const actionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().min(1).max(2_000).optional(),
  type: actionTypeSchema.optional(),
  status: actionStatusSchema.optional(),
  priority: actionPrioritySchema.optional(),
  ownerAgentId: idSchema.nullable().optional(),
  workspaceId: idSchema.nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  resolution: z.string().trim().max(2_000).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one action change is required.')
const memoryPolicySchema = z.object({
  mode: z.enum(['enabled', 'disabled']),
  retentionDays: z.number().int().min(1).max(3_650).nullable()
})
const guiStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('activateApp') }),
  z.object({ type: z.literal('wait'), durationMs: z.number().int().min(100).max(10_000) }),
  z.object({ type: z.literal('clickElement'), label: z.string().trim().min(1).max(120) }),
  z.object({ type: z.literal('typeText'), text: z.string().min(1).max(2_000) }),
  z.object({ type: z.literal('pressKey'), key: z.enum(['tab', 'escape', 'arrowUp', 'arrowDown', 'arrowLeft', 'arrowRight']) })
])
const guiSessionInputSchema = z.object({
  agentId: idSchema,
  targetApp: z.string().trim().min(1).max(120),
  objective: z.string().trim().min(1).max(500),
  steps: z.array(guiStepSchema).min(1).max(20),
  maxRetries: z.number().int().min(0).max(2)
})

export interface IpcSystemActions {
  dataDirectory: string
  defaultBackupDirectory: string
  createBackup: (destination: string) => Promise<string>
  restoreBackup: (source: string) => Promise<void>
  openExternal: (url: string) => Promise<{ browserName: string; forcedBrowser: boolean }>
}

export function registerIpc(service: CodexService, system: IpcSystemActions): void {
  const selectedChatImages = new Map<string, ResolvedChatImage>()
  ipcMain.handle('snapshot:get', (_event, agentId?: string) => service.getSnapshot(agentId ? idSchema.parse(agentId) : undefined))
  ipcMain.handle('runs:get', (_event, id) => service.getRun(idSchema.parse(id)))
  ipcMain.handle('imports:refresh', () => service.refreshImports())
  ipcMain.handle('imports:add', (_event, candidateKeys) => service.importSources(
    z.array(z.string().trim().min(1).max(300)).min(1).max(100).refine((values) => new Set(values).size === values.length, 'Selected imports must be unique.').parse(candidateKeys)
  ))
  ipcMain.handle('agents:create', (_event, input) => service.createAgent(agentInputSchema.parse(input)))
  ipcMain.handle('agents:update', (_event, id, input) => service.updateAgent(idSchema.parse(id), agentInputSchema.parse(input)))
  ipcMain.handle('agents:setConnectedAppGrant', (_event, id, appId, granted) => service.setAgentConnectedAppGrant(idSchema.parse(id), z.string().trim().min(1).max(200).parse(appId), z.boolean().parse(granted)))
  ipcMain.handle('agents:archive', (_event, id) => service.archiveAgent(idSchema.parse(id)))
  ipcMain.handle('chat:listMessages', (_event, agentId) => service.listMessages(idSchema.parse(agentId)))
  ipcMain.handle('chat:chooseImages', async () => {
    const paths = process.env.SPLITTBOT_TEST_ATTACHMENT_PATH
      ? [process.env.SPLITTBOT_TEST_ATTACHMENT_PATH]
      : (await dialog.showOpenDialog({
          title: 'Attach images to this task',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
        })).filePaths
    if (!paths.length) return []
    if (paths.length > MAX_CHAT_IMAGES) throw new Error(`Attach no more than ${MAX_CHAT_IMAGES} images to one task.`)
    const images = await Promise.all(paths.map(validateChatImagePath))
    return images.map((image) => {
      const id = randomUUID()
      selectedChatImages.set(id, image)
      const timer = setTimeout(() => selectedChatImages.delete(id), 30 * 60_000)
      timer.unref()
      return { id, type: image.type, name: image.name, size: image.size }
    })
  })
  ipcMain.handle('chat:send', async (_event, agentId, message, attachmentIds) => {
    const ids = z.array(idSchema).max(MAX_CHAT_IMAGES).refine((values) => new Set(values).size === values.length, 'Attached images must be unique.').optional().parse(attachmentIds) ?? []
    const selected = ids.map((id) => {
      const image = selectedChatImages.get(id)
      if (!image) throw new Error('An attached image expired or was not selected through SplittBot. Attach it again.')
      return image
    })
    const attachments = await Promise.all(selected.map(async (image) => {
      const current = await validateChatImagePath(image.path)
      if (current.name !== image.name || current.size !== image.size) throw new Error(`${image.name} changed after it was selected. Attach it again.`)
      return current
    }))
    const result = await service.startMessage(idSchema.parse(agentId), z.string().trim().max(100_000).parse(message), attachments)
    ids.forEach((id) => selectedChatImages.delete(id))
    return result
  })
  ipcMain.handle('chat:cancel', (_event, runId) => service.cancelRun(idSchema.parse(runId)))
  ipcMain.handle('approvals:resolve', (_event, approvalId, decision) => service.resolveApproval(idSchema.parse(approvalId), z.enum(['approve', 'decline', 'cancel']).parse(decision)))
  ipcMain.handle('approvals:ask', (_event, approvalId, question) => service.askApprovalQuestion(idSchema.parse(approvalId), z.string().trim().min(1).max(2_000).parse(question)))
  ipcMain.handle('approvals:editAndApprove', (_event, approvalId, input) => service.editAndApproveApproval(idSchema.parse(approvalId), z.string().max(100_000).parse(input)))
  ipcMain.handle('actions:create', (_event, input) => service.createAction(actionCreateSchema.parse(input)))
  ipcMain.handle('actions:update', (_event, id, input) => service.updateAction(idSchema.parse(id), actionUpdateSchema.parse(input)))
  ipcMain.handle('actions:start', (_event, id, recipe) => service.startAction(idSchema.parse(id), z.enum(['recommend', 'investigate', 'draft', 'meeting', 'moveForward']).parse(recipe)))
  ipcMain.handle('workspaces:create', (_event, input) => service.createWorkspace(workspaceInputSchema.parse(input)))
  ipcMain.handle('workspaces:update', (_event, id, input) => service.updateWorkspace(idSchema.parse(id), workspaceInputSchema.parse(input)))
  ipcMain.handle('workspaces:setStatus', (_event, id, status) => service.setWorkspaceStatus(idSchema.parse(id), z.enum(['active', 'completed', 'archived']).parse(status)))
  ipcMain.handle('workspaces:startTask', (_event, id, prompt) => service.startWorkspaceTask(idSchema.parse(id), z.string().trim().min(1).max(100_000).parse(prompt)))
  ipcMain.handle('connectors:refresh', () => service.refreshIntegrations())
  ipcMain.handle('connectors:add', (_event, input) => service.addConnector(connectorInputSchema.parse(input)))
  ipcMain.handle('connectors:update', (_event, name, input) => service.updateConnector(connectorNameSchema.parse(name), connectorInputSchema.parse(input)))
  ipcMain.handle('connectors:remove', (_event, name) => service.removeConnector(connectorNameSchema.parse(name)))
  ipcMain.handle('connectors:setEnabled', (_event, name, enabled) => service.setConnectorEnabled(connectorNameSchema.parse(name), z.boolean().parse(enabled)))
  ipcMain.handle('connectors:login', (_event, name) => service.loginConnector(connectorNameSchema.parse(name)))
  ipcMain.handle('connectors:logout', (_event, name) => service.logoutConnector(connectorNameSchema.parse(name)))
  ipcMain.handle('connectors:addAccount', (_event, input) => service.addConnectorAccount(connectorAccountInputSchema.parse(input)))
  ipcMain.handle('connectors:loginAccount', (_event, id) => service.loginConnectorAccount(idSchema.parse(id)))
  ipcMain.handle('connectors:logoutAccount', (_event, id) => service.logoutConnectorAccount(idSchema.parse(id)))
  ipcMain.handle('connectors:removeAccount', (_event, id) => service.removeConnectorAccount(idSchema.parse(id)))
  ipcMain.handle('skills:refresh', () => service.refreshIntegrations())
  ipcMain.handle('skills:review', (_event, path, status, notes) => service.reviewSkill(z.string().startsWith('/').parse(path), z.enum(['unreviewed', 'reviewed', 'blocked']).parse(status), z.string().trim().max(2_000).nullable().optional().parse(notes) ?? null))
  ipcMain.handle('skills:setEnabled', (_event, path, enabled) => service.setSkillEnabled(z.string().startsWith('/').parse(path), z.boolean().parse(enabled)))
  ipcMain.handle('routines:create', (_event, input) => service.createRoutine(routineInputSchema.parse(input)))
  ipcMain.handle('routines:update', (_event, id, input) => service.updateRoutine(idSchema.parse(id), routineInputSchema.parse(input)))
  ipcMain.handle('routines:setStatus', (_event, id, status) => service.setRoutineStatus(idSchema.parse(id), z.enum(['active', 'paused']).parse(status)))
  ipcMain.handle('routines:runNow', (_event, id) => service.runRoutineNow(idSchema.parse(id)))
  ipcMain.handle('routines:delete', (_event, id) => service.deleteRoutine(idSchema.parse(id)))
  ipcMain.handle('notifications:markRead', (_event, id) => service.markNotificationRead(idSchema.parse(id)))
  ipcMain.handle('notifications:markAllRead', () => service.markAllNotificationsRead())
  ipcMain.handle('memories:add', (_event, agentId, content) => service.addAgentMemory(idSchema.parse(agentId), z.string().trim().min(1).max(20_000).parse(content)))
  ipcMain.handle('memories:setPolicy', (_event, agentId, input) => service.setAgentMemoryPolicy(idSchema.parse(agentId), memoryPolicySchema.parse(input)))
  ipcMain.handle('memories:delete', (_event, id) => service.deleteAgentMemory(idSchema.parse(id)))
  ipcMain.handle('memories:clear', (_event, agentId) => service.clearAgentMemories(idSchema.parse(agentId)))
  ipcMain.handle('memories:deleteThread', (_event, agentId) => service.deleteAgentThread(idSchema.parse(agentId)))
  ipcMain.handle('memories:export', async (_event, agentId) => {
    const exported = service.getAgentMemoryExport(idSchema.parse(agentId))
    const safeName = exported.agent.name.replace(/[^A-Za-z0-9 _.-]/g, '').trim().slice(0, 80) || 'Agent'
    const result = process.env.SPLITTBOT_TEST_MEMORY_EXPORT_PATH
      ? { canceled: false, filePath: process.env.SPLITTBOT_TEST_MEMORY_EXPORT_PATH }
      : await dialog.showSaveDialog({ title: 'Export agent memory', defaultPath: join(system.defaultBackupDirectory, `${safeName} Memory.md`), filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (result.canceled || !result.filePath) return null
    await writePrivateFile(result.filePath, Buffer.from(exported.content, 'utf8'))
    return { path: result.filePath }
  })
  ipcMain.handle('shortcuts:prepare', (_event, agentId, name, input) => service.prepareShortcut(idSchema.parse(agentId), z.string().trim().min(1).max(180).parse(name), z.string().max(100_000).parse(input)))
  ipcMain.handle('gui:refreshPermissions', () => service.refreshGuiPermissions())
  ipcMain.handle('gui:requestPermission', (_event, kind) => service.requestGuiPermission(z.enum(['accessibility', 'screenRecording']).parse(kind)))
  ipcMain.handle('gui:openPermissionSettings', (_event, kind) => service.openGuiPermissionSettings(z.enum(['accessibility', 'screenRecording']).parse(kind)))
  ipcMain.handle('gui:prepare', (_event, input) => service.prepareGuiSession(guiSessionInputSchema.parse(input)))
  ipcMain.handle('gui:pause', (_event, id) => service.pauseGuiSession(idSchema.parse(id)))
  ipcMain.handle('gui:resume', (_event, id) => service.resumeGuiSession(idSchema.parse(id)))
  ipcMain.handle('gui:takeover', (_event, id) => service.takeoverGuiSession(idSchema.parse(id)))
  ipcMain.handle('gui:emergencyStop', () => service.emergencyStopGui())
  ipcMain.handle('gui:resetEmergencyStop', () => service.resetGuiEmergencyStop())
  ipcMain.handle('gui:evidenceDataUrl', (_event, id) => service.guiEvidenceDataUrl(idSchema.parse(id)))
  ipcMain.handle('acceptance:refreshPermissions', () => service.refreshAcceptancePermissions())
  ipcMain.handle('acceptance:exerciseIMessage', () => service.exerciseIMessageAcceptance())
  ipcMain.handle('acceptance:exerciseWakeCatchUp', () => service.exerciseWakeCatchUp())
  ipcMain.handle('acceptance:confirmWakeNotification', () => service.confirmWakeNotification())
  ipcMain.handle('artifacts:create', (_event, input) => {
    const parsed = z.object({ agentId: idSchema, runId: idSchema.nullable().optional(), name: z.string().trim().min(1).max(180), content: z.string().min(1).max(1_000_000) }).parse(input)
    return service.createArtifact(parsed)
  })
  ipcMain.handle('artifacts:export', async (_event, id) => {
    const artifact = service.getArtifactForExport(idSchema.parse(id))
    const safeName = artifact.name.replace(/[^A-Za-z0-9 _.-]/g, '').trim().slice(0, 120) || 'SplittBot artifact'
    const result = process.env.SPLITTBOT_TEST_ARTIFACT_PATH
      ? { canceled: false, filePath: process.env.SPLITTBOT_TEST_ARTIFACT_PATH }
      : await dialog.showSaveDialog({
          title: 'Export SplittBot artifact',
          defaultPath: join(system.defaultBackupDirectory, `${safeName}.md`),
          filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Plain text', extensions: ['txt'] }]
        })
    if (result.canceled || !result.filePath) return null
    await writePrivateFile(result.filePath, Buffer.from(artifact.content, 'utf8'))
    return { path: result.filePath }
  })
  ipcMain.handle('avatars:choose', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose an agent picture',
      properties: ['openFile'],
      filters: [{ name: 'Pictures', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    const metadata = await stat(path)
    if (!metadata.isFile() || metadata.size > MAX_AVATAR_BYTES) throw new Error('Choose a PNG, JPEG, or WebP picture smaller than 5 MB.')
    const bytes = await readFile(path)
    const mime = avatarImageMime(bytes)
    if (!mime) throw new Error('The selected file is not a valid PNG, JPEG, or WebP picture.')
    return { dataUrl: `data:${mime};base64,${bytes.toString('base64')}` }
  })
  ipcMain.handle('auth:refresh', () => service.refreshAccount(true))
  ipcMain.handle('auth:signIn', () => service.signIn())
  ipcMain.handle('auth:signOut', () => service.signOut())
  ipcMain.handle('data:createBackup', async () => {
    const defaultName = `SplittBot Backup ${new Date().toISOString().slice(0, 10)}.sqlite`
    const result = process.env.SPLITTBOT_TEST_BACKUP_PATH
      ? { canceled: false, filePath: process.env.SPLITTBOT_TEST_BACKUP_PATH }
      : await dialog.showSaveDialog({
          title: 'Create a SplittBot backup',
          defaultPath: join(system.defaultBackupDirectory, defaultName),
          filters: [{ name: 'SplittBot SQLite backup', extensions: ['sqlite'] }]
        })
    if (result.canceled || !result.filePath) return null
    return { path: await system.createBackup(result.filePath) }
  })
  ipcMain.handle('data:restoreBackup', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Restore a SplittBot backup',
      properties: ['openFile'],
      filters: [{ name: 'SplittBot SQLite backup', extensions: ['sqlite'] }]
    })
    const source = result.filePaths[0]
    if (result.canceled || !source) return null
    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      title: 'Restore SplittBot backup?',
      message: 'SplittBot will stop active work, preserve the current database as a safety copy, restore the selected backup, and restart.',
      detail: 'This changes local agent profiles, conversations, grants, routines, approvals, artifacts, and audit history.',
      buttons: ['Cancel', 'Restore and restart'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (confirmation.response !== 1) return null
    await system.restoreBackup(source)
    return { restored: true }
  })
  ipcMain.handle('data:revealLocalData', async () => {
    const error = await shell.openPath(system.dataDirectory)
    if (error) throw new Error(error)
  })
  ipcMain.handle('app:openExternal', async (_event, value) => {
    const url = new URL(z.string().parse(value))
    if (url.protocol !== 'https:') throw new Error('Only HTTPS links may be opened.')
    return system.openExternal(url.toString())
  })
  ipcMain.handle('app:revealPath', async (_event, value) => {
    const path = z.string().min(1).parse(value)
    if (process.env.SPLITTBOT_TEST_MODE !== '1') await revealFile(path)
  })
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:revealInstalledApp', async () => {
    if (process.env.SPLITTBOT_TEST_MODE === '1') return
    if (!app.isPackaged) throw new Error('Use the packaged SplittBot app for Mac permission setup.')
    await revealFile(dirname(dirname(dirname(app.getPath('exe')))))
  })
  ipcMain.handle('app:openFullDiskAccess', async () => {
    if (process.env.SPLITTBOT_TEST_MODE !== '1') await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')
  })
}
