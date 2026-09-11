import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CodexAppServerClient } from '../../src/main/codex/client'
import { SqliteStore } from '../../src/main/db/store'
import { CodexService } from '../../src/main/services/codex-service'
import { DeterministicGuiAdapter, GuiAutomationBroker } from '../../src/main/services/gui-automation'
import { LocalAutomationService } from '../../src/main/services/local-automation'
import { JsonLogger } from '../../src/main/services/logger'
import type { AgentInput } from '../../src/shared/contracts'

const input: AgentInput = {
  name: 'Atlas', role: 'Assistant', instructions: 'Answer the task.', color: '#16876f', model: null, reasoningEffort: null,
  avatar: { type: 'initials', value: null }, collaboratorIds: [], cwd: '/tmp', accessMode: 'readOnly',
  grants: { readableRoots: ['/tmp'], writableRoots: [], allowedCommands: [], allowedApps: [], allowedConnectedApps: [], allowedConnectors: [], allowedConnectorAccounts: [], allowedSkillPaths: [], allowedShortcuts: [], networkAccess: false }
}
const cleanup: Array<() => Promise<void>> = []
afterEach(async () => { for (const close of cleanup.splice(0)) await close() })

async function setup(...flags: string[]) {
  const directory = await mkdtemp(join(tmpdir(), 'splittbot-reliability-'))
  const store = await SqliteStore.open(':memory:')
  const logger = new JsonLogger(join(directory, 'runtime.jsonl'))
  const client = new CodexAppServerClient({ command: process.execPath, argsPrefix: [resolve('tests/fixtures/fake-app-server.mjs'), ...flags], source: 'test fixture' }, logger)
  class NoLocalApps extends LocalAutomationService { override async listShortcuts() { return [] } }
  const service = new CodexService(store, client, logger, new GuiAutomationBroker(directory, new DeterministicGuiAdapter()), () => undefined, new NoLocalApps())
  cleanup.push(async () => { await service.stop(); store.close() })
  const agent = await store.createAgent(input)
  return { service, store, client, agent }
}

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 4_000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for run state')
    await new Promise((done) => setTimeout(done, 10))
  }
}

describe('service reliability', () => {
  it('serializes rapid messages to the same persistent thread', async () => {
    const { service, store, agent } = await setup('--slow-initialize')
    const runs = await Promise.all(Array.from({ length: 4 }, (_, index) => service.startMessage(agent.id, `Task ${index}`)))
    await until(() => runs.every(({ runId }) => store.getRun(runId)?.status === 'completed'))
    expect(new Set(runs.map(({ runId }) => store.getRun(runId)?.threadId)).size).toBe(1)
    expect(store.listMessages(agent.id).filter((message) => message.role === 'assistant')).toHaveLength(4)
  })

  it('retains completion notifications received before the turn/start response', async () => {
    const { service, store, agent } = await setup('--immediate-completion')
    const { runId } = await service.startMessage(agent.id, 'Finish immediately')
    await until(() => store.getRun(runId)?.status === 'completed')
    expect(store.getRun(runId)?.output).toContain('FAKE_RESPONSE: Finish immediately')
  })

  it('does not start a cancelled queued turn and releases a cancelled approval', async () => {
    const { service, store, agent } = await setup()
    const first = await service.startMessage(agent.id, 'REQUEST_APPROVAL')
    await until(() => store.listApprovals().some((approval) => approval.status === 'pending'))
    const second = await service.startMessage(agent.id, 'Must never start')
    await service.cancelRun(second.runId)
    await service.cancelRun(first.runId)
    await until(() => store.listApprovals().every((approval) => approval.status !== 'pending'))
    const third = await service.startMessage(agent.id, 'Next task')
    await until(() => store.getRun(third.runId)?.status === 'completed')
    expect(store.getRun(second.runId)).toMatchObject({ status: 'cancelled', turnId: null })
    expect(store.getRun(first.runId)?.status).toBe('cancelled')
  })

  it('fails safely when connector settings cannot be verified', async () => {
    const { service, store, agent } = await setup('--fail-config')
    const { runId } = await service.startMessage(agent.id, 'A task with no connector grant')
    await until(() => store.getRun(runId)?.status === 'failed')
    expect(store.getRun(runId)).toMatchObject({ turnId: null, error: expect.stringContaining('could not verify connector access') })
  })

  it('does not resurrect a run cancelled while its thread is being prepared', async () => {
    const { service, store, client, agent } = await setup('--slow-thread')
    let starting!: () => void
    const threadRequested = new Promise<void>((done) => { starting = done })
    const request = client.request.bind(client)
    client.request = ((method: string, ...args: [Record<string, unknown>?, number?]) => {
      const result = request(method, ...args)
      if (method === 'thread/start') starting()
      return result
    }) as typeof client.request
    const { runId } = await service.startMessage(agent.id, 'Cancel during setup')
    await threadRequested
    await service.cancelRun(runId)
    const next = await service.startMessage(agent.id, 'After cancelled setup')
    await until(() => store.getRun(next.runId)?.status === 'completed')
    expect(store.getRun(runId)).toMatchObject({ status: 'cancelled', turnId: null })
  })

  it('fails a lost runtime promptly and can start again', async () => {
    const { service, store, agent } = await setup()
    const failed = await service.startMessage(agent.id, 'RUNTIME_EXIT')
    await until(() => store.getRun(failed.runId)?.status === 'failed')
    const retried = await service.startMessage(agent.id, 'Try again')
    await until(() => store.getRun(retried.runId)?.status === 'completed')
  })

  it('never retries a user-cancelled routine', async () => {
    const { service, store, agent } = await setup()
    const routine = await store.createRoutine({ agentId: agent.id, title: 'Routine', prompt: 'REQUEST_APPROVAL', schedule: { kind: 'interval', intervalMinutes: 60 }, catchUpPolicy: 'runOnce', maxRetries: 2, retryDelayMinutes: 1, notifyPolicy: 'never', skillPath: null }, new Date(Date.now() + 3_600_000).toISOString())
    await service.runRoutineNow(routine.id)
    await until(() => store.listRuns().some((run) => run.status === 'waitingApproval'))
    await service.cancelRun(store.listRuns()[0]!.id)
    await until(() => store.listRoutineAttempts()[0]?.status === 'failed')
    await service.stop()
    expect(store.listRoutineAttempts()).toHaveLength(1)
  })

  it('rejects a missing scheduled skill instead of silently dropping it', async () => {
    const { service, store, agent } = await setup()
    const routine = await store.createRoutine({ agentId: agent.id, title: 'Routine', prompt: 'Prepare a brief', schedule: { kind: 'interval', intervalMinutes: 60 }, catchUpPolicy: 'runOnce', maxRetries: 0, retryDelayMinutes: 1, notifyPolicy: 'never', skillPath: '/missing/SKILL.md' }, new Date().toISOString())
    await service.runRoutineNow(routine.id)
    await until(() => store.listRoutineAttempts()[0]?.status === 'failed')
    expect(store.listRoutineAttempts()[0]?.error).toContain('selected skill is no longer available')
    expect(store.listRuns()).toHaveLength(0)
  })

  it('keeps scheduled actions from losing their required date', async () => {
    const { service, agent } = await setup()
    const action = await service.createAction({ sourceAgentId: agent.id, title: 'Review the brief', summary: 'Review the completed brief before publishing.', type: 'task', priority: 'normal' })
    await service.updateAction(action.id, { status: 'scheduled', dueAt: new Date().toISOString() })
    await expect(service.updateAction(action.id, { dueAt: null })).rejects.toThrow('Choose a date')
    await expect(service.updateAction(action.id, { status: 'next', dueAt: null })).resolves.toMatchObject({ status: 'next', dueAt: null })
  })
})
