import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

let nextThread = 1
let nextTurn = 1
let pendingApproval = null
const connectorConfig = { demo_docs: { url: 'https://example.com/mcp', enabled: true } }
const authenticatedConnectors = new Set()

function log(message) {
  if (process.env.SPLITTBOT_FAKE_LOG) appendFileSync(process.env.SPLITTBOT_FAKE_LOG, `${JSON.stringify(message)}\n`)
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function completeTurn(threadId, turnId, text) {
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
  if (method === 'initialize') return send({ id, result: { userAgent: 'fake-codex', platformFamily: 'unix', platformOs: 'macos' } })
  if (method === 'account/read') return send({ id, result: { account: { type: 'chatgpt', email: 'phase0@example.com', planType: 'plus' }, requiresOpenaiAuth: true } })
  if (method === 'account/login/start') return send({ id, result: { type: 'chatgpt', loginId: 'fake-login', authUrl: 'https://auth.openai.com/fake' } })
  if (method === 'account/logout') return send({ id, result: {} })
  if (method === 'model/list') return send({ id, result: { data: [{ id: 'fake-codex-model', model: 'fake-codex-model', isDefault: true, displayName: 'Fake Codex', defaultReasoningEffort: 'medium', supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'medium' }, { reasoningEffort: 'high' }] }], nextCursor: null } })
  if (method === 'mcpServerStatus/list') return send({ id, result: { data: Object.keys(connectorConfig).map((name) => ({ name, pluginId: null, serverInfo: { name: name.startsWith('demo_docs_acct_') ? 'Demo Docs Account' : name === 'demo_docs' ? 'Demo Docs' : name, version: '1.0' }, tools: { search: { name: 'search', description: 'Search approved docs' } }, resources: [], resourceTemplates: [], authStatus: authenticatedConnectors.has(name) ? 'oAuth' : 'notLoggedIn' })), nextCursor: null } })
  if (method === 'config/read') return send({ id, result: { config: { mcp_servers: connectorConfig }, origins: {}, layers: null } })
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
  if (method === 'thread/start') {
    const thread = { id: `thr_fake_${nextThread++}`, sessionId: 'fake-session', preview: '', ephemeral: false }
    send({ id, result: { thread } })
    return send({ method: 'thread/started', params: { thread } })
  }
  if (method === 'thread/resume') {
    const thread = { id: params.threadId, sessionId: params.threadId, preview: '', ephemeral: false }
    send({ id, result: { thread } })
    return send({ method: 'thread/started', params: { thread } })
  }
  if (method === 'thread/name/set') return send({ id, result: {} })
  if (method === 'thread/memoryMode/set') return send({ id, result: {} })
  if (method === 'thread/delete') return send({ id, result: {} })
  if (method === 'turn/interrupt') return send({ id, result: {} })
  if (method === 'turn/steer') return send({ id, result: {} })
  if (method === 'turn/start') {
    const turnId = `turn_fake_${nextTurn++}`
    const text = `FAKE_RESPONSE: ${params.input?.[0]?.text || ''}`
    send({ id, result: { turn: { id: turnId, status: 'inProgress', items: [], error: null } } })
    send({ method: 'turn/started', params: { threadId: params.threadId, turn: { id: turnId, status: 'inProgress', items: [], error: null } } })
    if (text.includes('REQUEST_APPROVAL')) {
      const requestId = 90_000 + nextTurn
      pendingApproval = { requestId, threadId: params.threadId, turnId, text }
      return setTimeout(() => send({ method: 'item/commandExecution/requestApproval', id: requestId, params: { threadId: params.threadId, turnId, itemId: `cmd_${turnId}`, reason: 'The deterministic test requested approval.', command: ['echo', 'approved'], cwd: process.cwd() } }), 15)
    }
    return setTimeout(() => completeTurn(params.threadId, turnId, text), 20)
  }
  send({ id, error: { code: -32601, message: `Unknown fake method: ${method}` } })
})
