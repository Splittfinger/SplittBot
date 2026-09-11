import { mkdtemp, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { SqliteStore } from '../../src/main/db/store'
import * as privateFiles from '../../src/main/services/data-recovery'

const grants = { readableRoots: ['/tmp'], writableRoots: [], allowedCommands: [], allowedApps: [], allowedConnectedApps: [], allowedConnectors: [], allowedConnectorAccounts: [], allowedSkillPaths: [], allowedShortcuts: [], networkAccess: false }

describe('SqliteStore', () => {
  it('returns the newest history window in chronological order', async () => {
    const store = await SqliteStore.open(':memory:')
    const agent = await store.createAgent({ name: 'Atlas', role: 'Assistant', instructions: 'Help safely.', color: '#16876f', model: null, reasoningEffort: null, avatar: { type: 'initials', value: null }, collaboratorIds: [], cwd: '/tmp', accessMode: 'readOnly', grants })
    for (let index = 0; index < 320; index += 1) await store.addMessage({ agentId: agent.id, runId: null, role: 'user', kind: 'text', content: `Message ${index}` })
    expect(store.listMessages(agent.id).map((message) => message.content)).toEqual(Array.from({ length: 300 }, (_, index) => `Message ${index + 20}`))
    expect(store.listMessages(undefined, 2).map((message) => message.content)).toEqual(['Message 318', 'Message 319'])
    store.close()
  })

  it('serializes concurrent disk persistence without losing writes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-store-concurrent-'))
    const path = join(directory, 'state.sqlite')
    let store = await SqliteStore.open(path)
    const agent = await store.createAgent({ name: 'Atlas', role: 'Chief of Staff', instructions: 'Coordinate safely.', color: '#7657d8', model: null, reasoningEffort: null, avatar: { type: 'initials', value: null }, collaboratorIds: [], cwd: '/tmp', accessMode: 'readOnly', grants })
    const writes = vi.spyOn(privateFiles, 'writePrivateFile')
    await Promise.all(Array.from({ length: 20 }, async (_, index) => {
      await Promise.all([
        store.addMessage({ agentId: agent.id, runId: null, role: 'system', kind: 'status', content: `Concurrent message ${index}` }),
        store.addAudit({ type: 'concurrent.test', actor: 'system', agentId: agent.id, runId: null, summary: `Concurrent audit ${index}`, detail: { index } })
      ])
    }))
    // Forty logical mutations share the same flush instead of forty full exports.
    const writeCount = writes.mock.calls.length
    writes.mockRestore()
    expect(writeCount).toBeLessThanOrEqual(2)
    store.close()

    store = await SqliteStore.open(path)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(store.listMessages(agent.id)).toHaveLength(20)
    expect(store.listAudit().filter((event) => event.type === 'concurrent.test')).toHaveLength(20)
    // Exporting must not silently turn off relational integrity.
    await expect(store.addMessage({ agentId: crypto.randomUUID(), runId: null, role: 'user', kind: 'text', content: 'Invalid agent' })).rejects.toThrow('FOREIGN KEY')
    store.close()
  })

  it('recovers interrupted handoffs and AI follow-ups without changing ordinary waiting actions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-store-recovery-'))
    const path = join(directory, 'state.sqlite')
    let store = await SqliteStore.open(path)
    const agent = await store.createAgent({ name: 'Atlas', role: 'Assistant', instructions: 'Help safely.', color: '#16876f', model: null, reasoningEffort: null, avatar: { type: 'initials', value: null }, collaboratorIds: [], cwd: '/tmp', accessMode: 'readOnly', grants })
    const run = await store.createRun(agent.id, 'Unfinished task')
    const handoff = await store.createHandoff({ parentRunId: run.id, fromAgentId: agent.id, toAgentId: agent.id, prompt: 'Unfinished handoff' })
    const now = new Date().toISOString()
    const actionIds: string[] = []
    for (const fingerprint of ['ai-follow-up', 'ordinary-waiting']) {
      const action = await store.createAction({ title: 'Review a document', summary: 'Review the latest document.', type: 'task', status: 'waiting', priority: 'normal', ownerAgentId: null, sourceAgentId: agent.id, sourceRunId: null, sourceRoutineId: null, sourceAccountId: null, workspaceId: null, dueAt: null, firstSeenAt: now, lastSeenAt: now, fingerprint, evidence: [], resolution: null, createdBy: 'user' })
      actionIds.push(action.id)
      if (fingerprint === 'ai-follow-up') await store.addActionEvent({ actionId: action.id, runId: run.id, actor: 'user', type: 'suggestionStarted', summary: 'Requested AI follow-up', detail: {} })
    }
    store.close()
    store = await SqliteStore.open(path)
    expect(store.listHandoffs().find((item) => item.id === handoff.id)?.status).toBe('failed')
    expect(store.getAction(actionIds[0]!)?.status).toBe('blocked')
    expect(store.getAction(actionIds[1]!)?.status).toBe('waiting')
    store.close()
  })

  it('persists agents, messages, runs, artifacts, approvals, and audit events', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-store-'))
    const path = join(directory, 'state.sqlite')
    let store = await SqliteStore.open(path)
    const atlas = await store.createAgent({ name: 'Atlas', role: 'Chief of Staff', instructions: 'Synthesize the work.', color: '#16876f', model: null, reasoningEffort: null, avatar: { type: 'initials', value: null }, collaboratorIds: [], cwd: '/tmp', accessMode: 'readOnly', grants })
    const agent = await store.createAgent({ name: 'Maya', role: 'Researcher', instructions: 'Cite every claim with @Atlas.', color: '#7657d8', model: 'codex-test', reasoningEffort: 'high', avatar: { type: 'emoji', value: '🔬' }, collaboratorIds: [atlas.id], cwd: '/tmp', accessMode: 'readOnly', grants })
    const run = await store.createRun(agent.id, 'Research this')
    const handoff = await store.createHandoff({ parentRunId: run.id, fromAgentId: agent.id, toAgentId: atlas.id, prompt: 'Synthesize this' })
    await store.updateHandoff(handoff.id, { status: 'completed', result: 'Combined', completedAt: new Date().toISOString() })
    await store.addMessage({ agentId: agent.id, runId: run.id, role: 'user', kind: 'text', content: 'Research this' })
    await store.createArtifact({ agentId: agent.id, runId: run.id, name: 'Brief', content: 'Result' })
    await store.createApproval({ agentId: agent.id, runId: run.id, requestId: 'rpc-1', method: 'item/commandExecution/requestApproval', title: 'Run command', summary: 'echo', request: { command: ['echo'] } })
    await store.addAudit({ type: 'test', actor: 'system', agentId: agent.id, runId: run.id, summary: 'Recorded test', detail: {} })
    await store.setSkillReview('/tmp/fake-brief/SKILL.md', 'reviewed', 'Reviewed in test')
    const routine = await store.createRoutine({ agentId: agent.id, title: 'Morning brief', prompt: 'Prepare a brief', schedule: { kind: 'daily', timeOfDay: '08:00', daysOfWeek: [1, 2, 3, 4, 5] }, catchUpPolicy: 'runOnce', maxRetries: 2, retryDelayMinutes: 5, notifyPolicy: 'always', skillPath: '/tmp/fake-brief/SKILL.md' }, '2026-08-22T14:00:00.000Z')
    await store.createRoutineAttempt({ routineId: routine.id, runId: run.id, attemptNo: 1, status: 'completed', scheduledFor: '2026-08-21T14:00:00.000Z', startedAt: '2026-08-21T14:00:00.000Z', completedAt: '2026-08-21T14:01:00.000Z' })
    await store.createNotification({ type: 'routineCompleted', title: 'SplittBot routine', body: 'Morning brief completed.', agentId: agent.id, runId: run.id })
    const workspace = await store.createWorkspace({ name: 'Launch desk', objective: 'Coordinate the launch.', currentOwnerAgentId: agent.id, memberIds: [agent.id, atlas.id], autoCoordinate: false })
    await store.addWorkspaceEvent({ workspaceId: workspace.id, runId: run.id, agentId: agent.id, type: 'handoff', summary: 'Maya asked Atlas to synthesize', detail: { handoffId: handoff.id } })
    const memory = await store.createAgentMemory(agent.id, 'Use primary sources.')
    const connectorAccount = await store.createConnectorAccount({ connectorName: 'demo_docs', label: 'Work', accountIdentifier: 'work@example.com' }, 'demo_docs_acct_123456789abc')
    await store.updateAgent(agent.id, { name: agent.name, role: agent.role, instructions: agent.instructions, color: agent.color, model: agent.model, reasoningEffort: agent.reasoningEffort, avatar: agent.avatar, collaboratorIds: agent.collaboratorIds, cwd: agent.cwd, accessMode: agent.accessMode, grants: { ...agent.grants, allowedConnectorAccounts: [connectorAccount.id] } })
    await store.setAgentMemoryPolicy(agent.id, { mode: 'disabled', retentionDays: 90 })
    await store.recordAcceptanceCheck({ key: 'permissions', label: 'Packaged permissions', status: 'blocked', detail: 'Not granted.', evidence: null, checkedAt: new Date().toISOString() })
    const guiSession = await store.createGuiSession({ agentId: agent.id, targetApp: 'Preview', objective: 'Open a document safely.', steps: [{ type: 'activateApp' }, { type: 'wait', durationMs: 500 }], maxRetries: 1 }, 'b'.repeat(64))
    await store.updateGuiSession(guiSession.id, { status: 'completed', currentStep: 2, startedAt: '2026-08-21T14:00:00.000Z', completedAt: '2026-08-21T14:00:01.000Z' })
    await store.createGuiEvidence({ sessionId: guiSession.id, kind: 'after', stepIndex: 1, summary: 'Verified Preview', path: '/tmp/preview.png' })
    await store.setGuiEmergencyStopped(true)
    await store.createImportedSource({
      sourceKey: 'codexThread:thr_marketing', sourceKind: 'codexThread', sourceId: 'thr_marketing', name: 'Marketing Agent',
      targetKind: 'agent', targetId: agent.id, status: 'available', detail: { summary: 'Draft a campaign brief.' },
      sourceUpdatedAt: '2026-08-21T14:00:00.000Z', lastSeenAt: '2026-08-21T14:01:00.000Z'
    })
    await store.updateImportedSource('codexThread:thr_marketing', { status: 'notLoaded', lastSeenAt: '2026-08-21T14:02:00.000Z' })
    await store.setAgentCollaborators(agent.id, [agent.id, atlas.id, atlas.id])
    const action = await store.createAction({
      title: 'Decide whether the invoice is valid', summary: 'The mailbox run found an invoice that needs a decision.',
      type: 'decision', status: 'inbox', priority: 'high', ownerAgentId: atlas.id, sourceAgentId: agent.id,
      sourceRunId: run.id, sourceRoutineId: routine.id, sourceAccountId: connectorAccount.id, workspaceId: workspace.id,
      dueAt: null, firstSeenAt: '2026-08-21T14:01:00.000Z', lastSeenAt: '2026-08-21T14:01:00.000Z',
      fingerprint: 'invoice-fingerprint', evidence: [{ runId: run.id, excerpt: 'Invoice needs a decision.', observedAt: '2026-08-21T14:01:00.000Z' }],
      resolution: null, createdBy: 'agent'
    })
    await store.addActionEvent({ actionId: action.id, runId: run.id, actor: 'agent', type: 'created', summary: 'Captured from a completed result', detail: { priority: 'high' } })
    await store.updateAction(action.id, { status: 'next', dueAt: '2026-08-22T17:00:00.000Z' })
    store.close()

    store = await SqliteStore.open(path)
    expect(store.listAgents()).toHaveLength(2)
    expect(store.getAgent(agent.id)).toMatchObject({ reasoningEffort: 'high', avatar: { type: 'emoji', value: '🔬' }, collaboratorIds: [atlas.id], memoryMode: 'disabled', memoryRetentionDays: 90 })
    expect(store.listMessages(agent.id)[0]?.content).toBe('Research this')
    expect(store.listRuns()[0]?.status).toBe('failed')
    expect(store.listArtifacts()[0]?.name).toBe('Brief')
    expect(store.listApprovals()[0]?.status).toBe('expired')
    expect(store.listAudit()[0]?.summary).toBe('Recorded test')
    expect(store.listHandoffs()[0]).toMatchObject({ status: 'completed', result: 'Combined', toAgentId: atlas.id })
    expect(store.listSkillReviews()[0]).toMatchObject({ status: 'reviewed', notes: 'Reviewed in test' })
    expect(store.listRoutines()[0]).toMatchObject({ title: 'Morning brief', maxRetries: 2, catchUpPolicy: 'runOnce' })
    expect(store.listRoutineAttempts()[0]).toMatchObject({ status: 'completed', attemptNo: 1 })
    expect(store.listNotifications()[0]).toMatchObject({ type: 'routineCompleted', read: false })
    expect(store.listGuiSessions()[0]).toMatchObject({ targetApp: 'Preview', status: 'completed', currentStep: 2, maxRetries: 1 })
    expect(store.listGuiEvidence()[0]).toMatchObject({ kind: 'after', summary: 'Verified Preview' })
    expect(store.listWorkspaces()[0]).toMatchObject({ name: 'Launch desk', memberIds: [agent.id, atlas.id], autoCoordinate: false })
    expect(store.listWorkspaceEvents()[0]).toMatchObject({ type: 'handoff', workspaceId: workspace.id })
    expect(store.getAgentMemory(memory.id)).toMatchObject({ content: 'Use primary sources.' })
    expect(store.getConnectorAccount(connectorAccount.id)).toMatchObject({ connectorName: 'demo_docs', runtimeName: 'demo_docs_acct_123456789abc', label: 'Work', accountIdentifier: 'work@example.com' })
    expect(store.getAgent(agent.id)?.grants.allowedConnectorAccounts).toEqual([connectorAccount.id])
    expect(store.listAcceptanceChecks()[0]).toMatchObject({ key: 'permissions', status: 'blocked' })
    expect(store.isGuiEmergencyStopped()).toBe(true)
    expect(store.listImportedSources()[0]).toMatchObject({ sourceKey: 'codexThread:thr_marketing', targetId: agent.id, status: 'notLoaded', detail: { summary: 'Draft a campaign brief.' } })
    expect(store.getAgent(agent.id)?.collaboratorIds).toEqual([atlas.id])
    expect(store.listActions()[0]).toMatchObject({ id: action.id, status: 'next', type: 'decision', priority: 'high', ownerAgentId: atlas.id, sourceRoutineId: routine.id, evidence: [{ excerpt: 'Invoice needs a decision.' }] })
    expect(store.listActionEvents()[0]).toMatchObject({ actionId: action.id, type: 'created' })
    expect(store.getRoutineIdForRun(run.id)).toBe(routine.id)
    expect(store.getWorkspaceIdForRun(run.id)).toBe(workspace.id)
    await store.deleteRoutine(routine.id)
    expect(store.listRoutines()).toHaveLength(0)
    expect(store.listRoutineAttempts()).toHaveLength(0)
    await store.removeConnectorAccount(connectorAccount.id)
    expect(store.listConnectorAccounts()).toHaveLength(0)
    expect(store.getAgent(agent.id)?.grants.allowedConnectorAccounts).toEqual([])
    store.close()
  })
})
