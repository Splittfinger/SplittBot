import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CodexAppServerClient } from '../src/main/codex/client'
import { resolveCodexLaunch } from '../src/main/codex/runtime'
import { JsonLogger } from '../src/main/services/logger'
import { resolveSkillDisplayName } from '../src/main/services/skill-display-name'

const launch = resolveCodexLaunch()
const logDirectory = await mkdtemp(join(tmpdir(), 'splittbot-live-'))
const client = new CodexAppServerClient(launch, new JsonLogger(join(logDirectory, 'live.jsonl')), 60_000)

function compactConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactConfig)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== null && entry !== '')
    .map(([key, entry]) => [key, compactConfig(entry)]))
}

client.setServerRequestHandler(async (method) => {
  if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') return { decision: 'decline' }
  if (method === 'item/tool/requestUserInput') return { answers: {} }
  throw new Error(`Unexpected live server request: ${method}`)
})

async function runTurn(threadId: string, prompt: string): Promise<string> {
  let final = ''
  let streamed = ''
  let resolveCompletion!: (value: string) => void
  let rejectCompletion!: (error: Error) => void
  const completion = new Promise<string>((resolve, reject) => { resolveCompletion = resolve; rejectCompletion = reject })
  const timeout = setTimeout(() => rejectCompletion(new Error('Live Codex turn timed out.')), 240_000)
  const handler = (method: string, params: Record<string, unknown>): void => {
    const item = params.item as { type?: string; text?: string } | undefined
    if (method === 'item/agentMessage/delta' && typeof params.delta === 'string') streamed += params.delta
    if (method === 'item/completed' && item?.type === 'agentMessage' && item.text) final = item.text
    if (method === 'turn/completed') {
      const turn = params.turn as { id?: string; status?: string; error?: { message?: string } } | undefined
      if (turn?.id !== turnId) return
      clearTimeout(timeout)
      client.off('notification', handler)
      if (turn.status === 'completed') resolveCompletion(final || streamed)
      else rejectCompletion(new Error(turn.error?.message || `Live turn ${turn.status}`))
    }
  }
  client.on('notification', handler)
  const response = await client.request<{ turn: { id: string } }>('turn/start', {
    threadId,
    input: [{ type: 'text', text: prompt }],
    cwd: process.cwd(),
    approvalPolicy: 'on-request',
    approvalsReviewer: 'user',
    sandboxPolicy: { type: 'readOnly', networkAccess: false },
    effort: 'low',
    summary: 'concise'
  }, 60_000)
  const turnId = response.turn.id
  return completion
}

try {
  await client.start()
  const account = await client.request<{ account: { type: string; email?: string; planType?: string } | null }>('account/read', { refreshToken: true })
  if (!account.account || account.account.type !== 'chatgpt') throw new Error('Live Codex is not authenticated with ChatGPT.')
  const models = await client.request<{ data: Array<{ id: string; displayName: string }> }>('model/list', { limit: 20, includeHidden: false })
  if (!models.data.length) throw new Error('Live Codex returned no models.')
  let mcp: { data: Array<{ name: string }> } = { data: [] }
  let mcpWarning: string | null = null
  try {
    mcp = await client.request<{ data: Array<{ name: string }> }>('mcpServerStatus/list', { limit: 200, detail: 'toolsAndAuthOnly' })
  } catch (error) {
    mcpWarning = error instanceof Error ? error.message : String(error)
  }
  let skills: { data: Array<{ skills: Array<{ name: string; description: string; path: string }> }> } = { data: [] }
  let skillsWarning: string | null = null
  try {
    skills = await client.request<{ data: Array<{ skills: Array<{ name: string; description: string; path: string }> }> }>('skills/list', { cwds: [process.cwd()], forceReload: true })
  } catch (error) {
    skillsWarning = error instanceof Error ? error.message : String(error)
  }
  const liveConfig = await client.request<{ config: Record<string, unknown> }>('config/read', { includeLayers: false })
  const configuredMcp = (liveConfig.config.mcp_servers ?? {}) as Record<string, Record<string, unknown>>
  const discoveredSkills = skills.data.flatMap((entry) => entry.skills)
  if (!discoveredSkills.some((skill) => skill.name === 'manage-imessages')) throw new Error('The manage-imessages skill was not discovered by Codex.')
  const friendlySkillNames = await Promise.all(discoveredSkills.map(async (skill) => ({
    technicalName: skill.name,
    displayName: await resolveSkillDisplayName(skill)
  })))
  if (friendlySkillNames.some((skill) => !skill.displayName || /^app-[\da-f-]{16,}:/i.test(skill.displayName))) {
    throw new Error('At least one discovered Codex skill did not receive a usable friendly display name.')
  }
  if (friendlySkillNames.find((skill) => skill.technicalName === 'manage-imessages')?.displayName !== 'Local iMessage') {
    throw new Error('The local iMessage skill did not receive its friendly display name.')
  }
  const started = await client.request<{ thread: { id: string } }>('thread/start', {
    cwd: process.cwd(), approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'read-only',
    config: { mcp_servers: Object.fromEntries(Object.entries(configuredMcp).map(([name, value]) => [name, { ...(compactConfig(value) as Record<string, unknown>), enabled: false }])) },
    developerInstructions: 'This is a non-destructive SplittBot Phase 3 protocol test. Do not use tools or computer control.', ephemeral: false, serviceName: 'splittbot-phase3-test'
  })
  const first = await runTurn(started.thread.id, 'Reply with exactly SPLITTBOT_PHASE3_OK and no other text. Do not use tools.')
  if (!first.includes('SPLITTBOT_PHASE3_OK')) throw new Error(`Unexpected first response: ${first}`)

  await client.restart()
  const resumed = await client.request<{ thread: { id: string } }>('thread/resume', { threadId: started.thread.id })
  const second = await runTurn(resumed.thread.id, 'Reply with exactly SPLITTBOT_RESUME_OK and no other text. Do not use tools.')
  if (!second.includes('SPLITTBOT_RESUME_OK')) throw new Error(`Unexpected resumed response: ${second}`)

  process.stdout.write(`${JSON.stringify({ ok: true, accountType: account.account.type, planType: account.account.planType, models: models.data.length, connectors: mcp.data.map((server) => server.name), configuredConnectors: Object.keys((liveConfig.config.mcp_servers ?? {}) as Record<string, unknown>), mcpWarning, skills: discoveredSkills.length, friendlySkillNames: friendlySkillNames.slice(0, 8), manageImessagesSkill: true, skillsWarning, first, second, threadId: started.thread.id, runtime: launch.source }, null, 2)}\n`)
} finally {
  await client.stop()
}
