import assert from 'node:assert/strict'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { CodexAppServerClient } from '../src/main/codex/client'
import { JsonLogger } from '../src/main/services/logger'
import { appPolicy, withUserToolApprovals } from '../src/main/services/tool-policy'

// Deliberately requires an explicit executable. This never borrows an existing
// login, runs a model turn, or connects to a mailbox. It validates the actual
// bundled parser/protocol, not the deterministic App Server fixture.
const executable = process.argv[2]
if (!executable) throw new Error('Usage: npm run test:runtime-policy -- /absolute/path/to/bundled/codex')
const directory = await mkdtemp(join(tmpdir(), 'splittbot-policy-protocol-'))
await mkdir(join(directory, 'profile'), { mode: 0o700 })
const client = new CodexAppServerClient({
  command: resolve(executable), argsPrefix: [], source: 'explicit beta policy check', home: join(directory, 'profile')
}, new JsonLogger(join(directory, 'logs', 'runtime.jsonl')))
client.setServerRequestHandler(async () => { throw new Error('No tool execution or permission requests are allowed in this check.') })

try {
  await client.start()
  const policy = appPolicy({ tools: { send: { approval_mode: 'approve' } }, links: { sample: { default_tools_approval_mode: 'approve' } } }, false, true)
  const defaults = appPolicy({}, false, true)
  delete defaults.tools
  delete defaults.links
  const response = await client.request<{ thread: { id: string }; approvalsReviewer: string; sandbox: { type: string } }>('thread/start', {
    cwd: directory, ephemeral: true, approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'read-only',
    developerInstructions: 'Protocol validation only. No model turn will be started.',
    config: {
      apps: { _default: defaults, connector_beta_disabled: policy },
      mcp_servers: { beta_disabled: withUserToolApprovals({ url: 'https://example.com/mcp', enabled: false }) }
    }
  })
  assert.ok(response.thread.id)
  assert.equal(response.approvalsReviewer, 'user')
  assert.equal(response.sandbox.type, 'readOnly')
  process.stdout.write('PASS: bundled runtime accepted hardened app, account, and MCP policy; read-only sandbox and human reviewer confirmed. No model turn, login, or external tool call.\n')
} finally {
  await client.stop()
}
