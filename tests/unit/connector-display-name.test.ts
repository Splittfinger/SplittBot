import { describe, expect, it } from 'vitest'
import { resolveConnectorDisplayName } from '../../src/main/services/connector-display-name'

describe('friendly connector names', () => {
  it('explains the purpose of each Codex-managed connector', () => {
    expect(resolveConnectorDisplayName({ name: 'cloudflare-api' })).toBe('Cloudflare Account Connector')
    expect(resolveConnectorDisplayName({ name: 'codex_app' })).toBe('Codex App Tools')
    expect(resolveConnectorDisplayName({ name: 'codex_apps' })).toBe('Connected Apps & Services')
    expect(resolveConnectorDisplayName({ name: 'computer-history' })).toBe('Computer Activity History')
    expect(resolveConnectorDisplayName({ name: 'computer-use' })).toBe('Mac Computer Control')
    expect(resolveConnectorDisplayName({ name: 'dataAnalyticsWidgets' })).toBe('Data Analytics Visuals')
    expect(resolveConnectorDisplayName({ name: 'node_repl' })).toBe('Browser & App Automation Runtime')
  })

  it('uses useful server metadata for user-configured connectors', () => {
    expect(resolveConnectorDisplayName({ name: 'demo_docs', serverInfo: { name: 'Demo Docs' } })).toBe('Demo Docs')
    expect(resolveConnectorDisplayName({ name: 'legal_search', serverInfo: { displayName: 'legal_search', title: 'Legal Research Library' } })).toBe('Legal Research Library')
  })

  it('formats unknown identifiers while ignoring redundant or unsafe metadata', () => {
    expect(resolveConnectorDisplayName({ name: 'github_mcp', serverInfo: { name: 'github-mcp' } })).toBe('GitHub MCP')
    expect(resolveConnectorDisplayName({ name: 'project_docs', serverInfo: { title: '\u0000bad' } })).toBe('Project Docs')
  })
})
