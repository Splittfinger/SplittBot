import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

let nextThread = 1
let nextTurn = 1
let pendingApproval = null
const connectorConfig = {
  demo_docs: { url: 'https://example.com/mcp', enabled: true },
  codex_apps: { command: '/Applications/ChatGPT.app/Contents/Resources/codex_apps', enabled: true }
}
const authenticatedConnectors = new Set()
let experimentalApiEnabled = false
let initialized = false
const busyThreads = new Set()

function log(message) {
  if (process.env.SPLITTBOT_FAKE_LOG) appendFileSync(process.env.SPLITTBOT_FAKE_LOG, `${JSON.stringify(message)}\n`)
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function completeTurn(threadId, turnId, text) {
  busyThreads.delete(threadId)
  const itemId = `item_${turnId}`
  send({ method: 'item/started', params: { threadId, turnId, item: { type: 'agentMessage', id: itemId, text: '' } } })
  send({ method: 'item/agentMessage/delta', params: { threadId, turnId, itemId, delta: text } })
  send({ method: 'item/completed', params: { threadId, turnId, completedAtMs: Date.now(), item: { type: 'agentMessage', id: itemId, text, phase: 'final_answer' } } })
  send({ method: 'turn/completed', params: { threadId, turn: { id: turnId, items: [], status: 'completed', error: null } } })
}

const lines = createInterface({ input: process.stdin })
lines.on('line', (line) => {
  const message = JSON.parse(line)
  log(message)

  if (message.id !== undefined && !message.method) {
    if (pendingApproval && message.id === pendingApproval.requestId) {
      const { threadId, turnId, text } = pendingApproval
      pendingApproval = null
      setTimeout(() => completeTurn(threadId, turnId, `${text} · approval=${message.result?.decision || 'unknown'}`), 10)
    }
    return
  }

  if (!message.method || message.id === undefined) return
  const { id, method, params = {} } = message
  if (method === 'initialize') {
    experimentalApiEnabled = params.capabilities?.experimentalApi === true
    const finish = () => {
      initialized = true
      send({ id, result: { userAgent: 'fake-codex', platformFamily: 'unix', platformOs: 'macos' } })
    }
    return process.argv.includes('--slow-initialize') ? setTimeout(finish, 100) : finish()
  }
  if (!initialized) return send({ id, error: { code: -32000, message: 'Not initialized yet' } })
  if (method === 'account/read') return send({ id, result: { account: { type: 'chatgpt', email: 'phase0@example.com', planType: 'plus' }, requiresOpenaiAuth: true } })
  if (method === 'account/rateLimits/read') {
    if (process.env.SPLITTBOT_FAKE_USAGE_UNAVAILABLE === '1') return send({ id, error: { code: -32601, message: 'Usage is unavailable in this fake runtime.' } })
    const nowSeconds = Math.floor(Date.now() / 1000)
    const codex = {
      limitId: 'codex', limitName: null, planType: 'plus',
      primary: { usedPercent: 37, windowDurationMins: 300, resetsAt: nowSeconds + 3_600 },
      secondary: { usedPercent: 62, windowDurationMins: 10_080, resetsAt: nowSeconds + 6 * 86_400 },
      credits: { hasCredits: true, unlimited: false, balance: '12.5' },
      spendControlReached: false, rateLimitReachedType: null
    }
    const spark = {
      limitId: 'codex_spark', limitName: 'GPT-5.3-Codex-Spark', planType: 'plus',
      primary: { usedPercent: 4, windowDurationMins: 300, resetsAt: nowSeconds + 7_200 },
      secondary: null, credits: null, spendControlReached: null, rateLimitReachedType: null
    }
    return send({ id, result: { rateLimits: codex, rateLimitsByLimitId: { codex, codex_spark: spark }, rateLimitResetCredits: { availableCount: 1, credits: null } } })
  }
  if (method === 'account/login/start') return send({ id, result: { type: 'chatgpt', loginId: 'fake-login', authUrl: 'https://auth.openai.com/fake' } })
  if (method === 'account/logout') return send({ id, result: {} })
  if (method === 'model/list') return send({ id, result: { data: [{ id: 'fake-codex-model', model: 'fake-codex-model', isDefault: true, displayName: 'Fake Codex', defaultReasoningEffort: 'medium', supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'medium' }, { reasoningEffort: 'high' }] }], nextCursor: null } })
  if (method === 'app/installed') return send({ id, result: { apps: [
    { id: 'connector_outlook_email_fake', runtimeName: 'Microsoft Outlook Email', enabled: true, callable: true },
    { id: 'connector_outlook_calendar_fake', runtimeName: 'Microsoft Outlook Calendar', enabled: true, callable: true }
  ] } })
  if (method === 'app/list') return send({ id, result: { data: [
    { id: 'connector_outlook_email_fake', name: 'Outlook Email', description: 'Search, read, and organize mail through your Microsoft account.', installUrl: 'https://chatgpt.com/apps/outlook-email/connector_outlook_email_fake', isAccessible: true, isEnabled: true },
    { id: 'connector_outlook_calendar_fake', name: 'Outlook Calendar', description: 'Read and manage calendar events through your Microsoft account.', installUrl: 'https://chatgpt.com/apps/outlook-calendar/connector_outlook_calendar_fake', isAccessible: true, isEnabled: true },
    { id: 'google-drive', name: 'Google Drive', description: 'Find and work with files in Google Drive.', installUrl: 'https://chatgpt.com/apps/google-drive/google-drive', isAccessible: false, isEnabled: true }
  ], nextCursor: null } })
  if (method === 'mcpServerStatus/list') return send({ id, result: { data: Object.keys(connectorConfig).map((name) => ({ name, pluginId: null, serverInfo: { name: name.startsWith('demo_docs_acct_') ? 'Demo Docs Account' : name === 'demo_docs' ? 'Demo Docs' : name, version: '1.0' }, tools: { search: { name: 'search', description: 'Search approved docs' } }, resources: [], resourceTemplates: [], authStatus: authenticatedConnectors.has(name) ? 'oAuth' : 'notLoggedIn' })), nextCursor: null } })
  if (method === 'config/read') return process.argv.includes('--fail-config')
    ? send({ id, error: { code: -32000, message: 'Configuration unavailable' } })
    : send({ id, result: { config: { mcp_servers: connectorConfig,
      ...(process.argv.includes('--inherited-app-access') ? { apps: {
        _default: { enabled: true, approvals_reviewer: 'auto_review', default_tools_approval_mode: 'approve' },
        hidden_app: { enabled: true, tools: { publish: { enabled: true, approval_mode: 'approve' } } },
        connector_outlook_email_fake: { enabled: true, tools: { send: { approval_mode: 'approve' } } }
      } } : {})
    }, origins: {}, layers: null } })
  if (method === 'config/value/write') {
    const match = String(params.keyPath || '').match(/^mcp_servers\.([A-Za-z0-9_-]+)(?:\.enabled)?$/)
    if (match) {
      const name = match[1]
      if (String(params.keyPath).endsWith('.enabled')) connectorConfig[name] = { ...(connectorConfig[name] || {}), enabled: Boolean(params.value) }
      else if (params.value === null) delete connectorConfig[name]
      else connectorConfig[name] = params.value
    }
    return send({ id, result: { status: 'ok', version: 'fake-version' } })
  }
  if (method === 'config/mcpServer/reload') return send({ id, result: {} })
  if (method === 'mcpServer/oauth/login') {
    authenticatedConnectors.add(String(params.name))
    return send({ id, result: { authorizationUrl: `https://example.com/oauth?server=${encodeURIComponent(String(params.name))}` } })
  }
  if (method === 'mcpServer/oauth/logout') {
    authenticatedConnectors.delete(String(params.name))
    return send({ id, result: {} })
  }
  if (method === 'skills/list') return send({ id, result: { data: (params.cwds || [process.cwd()]).map((cwd) => ({ cwd, skills: [{ name: 'fake-brief', description: 'Prepare a deterministic brief.', path: '/tmp/fake-brief/SKILL.md', scope: 'user', enabled: true, dependencies: { tools: [] } }], errors: [] })) } })
  if (method === 'skills/config/write') return send({ id, result: {} })
  if (method === 'thread/list') return send({ id, result: {
    data: process.env.SPLITTBOT_FAKE_IMPORTS === '1' ? [{
      id: 'thr_import_marketing', name: 'Marketing Agent', preview: 'Prepare campaign research and draft a source-backed marketing brief.',
      cwd: process.env.SPLITTBOT_FAKE_IMPORT_CWD || process.cwd(), model: 'fake-codex-model',
      updatedAt: Math.floor(Date.now() / 1_000), ephemeral: false, status: { type: 'notLoaded' }, sourceKind: 'vscode'
    }] : [],
    nextCursor: null
  } })
  if (method === 'thread/start') {
    const thread = { id: `thr_fake_${nextThread++}`, sessionId: 'fake-session', preview: '', ephemeral: false }
    if (process.argv.includes('--slow-thread')) return setTimeout(() => send({ id, result: { thread } }), 150)
    send({ id, result: { thread } })
    return send({ method: 'thread/started', params: { thread } })
  }
  if (method === 'thread/resume') {
    const thread = { id: params.threadId, sessionId: params.threadId, preview: '', ephemeral: false }
    send({ id, result: { thread } })
    return send({ method: 'thread/started', params: { thread } })
  }
  if (method === 'thread/name/set') return send({ id, result: {} })
  if (method === 'thread/memoryMode/set') {
    if (!experimentalApiEnabled) return send({ id, error: { code: -32602, message: 'thread/memoryMode/set requires experimentalApi capability' } })
    return send({ id, result: {} })
  }
  if (method === 'thread/delete') return send({ id, result: {} })
  if (method === 'turn/interrupt') {
    busyThreads.delete(params.threadId)
    return send({ id, result: {} })
  }
  if (method === 'turn/steer') return send({ id, result: {} })
  if (method === 'turn/start') {
    if (busyThreads.has(params.threadId)) return send({ id, error: { code: -32000, message: 'Thread already has an active turn' } })
    busyThreads.add(params.threadId)
    const turnId = `turn_fake_${nextTurn++}`
    const inputText = params.input?.[0]?.text || ''
    const text = String(inputText).includes('ACTION_OUTPUT')
      ? 'Mailbox cleanup completed.\n\nDecisions still needed: whether the invoice is valid and should be paid, whether recent security activity was authorized, and whether to submit the settlement claim.'
      : `FAKE_RESPONSE: ${inputText}`
    if (inputText.includes('RUNTIME_EXIT')) return process.exit(2)
    if (process.argv.includes('--immediate-completion')) completeTurn(params.threadId, turnId, text)
    send({ id, result: { turn: { id: turnId, status: 'inProgress', items: [], error: null } } })
    send({ method: 'turn/started', params: { threadId: params.threadId, turn: { id: turnId, status: 'inProgress', items: [], error: null } } })
    if (process.argv.includes('--immediate-completion')) return
    if (text.includes('REQUEST_APPROVAL')) {
      const requestId = 90_000 + nextTurn
      pendingApproval = { requestId, threadId: params.threadId, turnId, text }
      return setTimeout(() => send({ method: 'item/commandExecution/requestApproval', id: requestId, params: { threadId: params.threadId, turnId, itemId: `cmd_${turnId}`, reason: 'The deterministic test requested approval.', command: ['echo', 'approved'], cwd: process.cwd() } }), 0)
    }
    return setTimeout(() => completeTurn(params.threadId, turnId, text), inputText.includes('SLOW_TURN') ? 200 : 20)
  }
  send({ id, error: { code: -32601, message: `Unknown fake method: ${method}` } })
})
