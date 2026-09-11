import { describe, expect, it } from 'vitest'
import { appPolicy, withUserToolApprovals } from '../../src/main/services/tool-policy'

describe('runtime tool review policies', () => {
  it('overrides automatic approvals without enabling disabled tools or changing transport', () => {
    const input = { url: 'https://example.com/mcp', enabled: false, default_tools_approval_mode: 'approve', tools: {
      send: { approval_mode: 'approve' }, remove: { enabled: false }, search: { approval_mode: 'prompt' }
    } }
    expect(withUserToolApprovals(input)).toEqual({ ...input, default_tools_approval_mode: 'writes', tools: {
      send: { approval_mode: 'writes' }, remove: { enabled: false, approval_mode: 'writes' }, search: { approval_mode: 'prompt' }
    } })
    expect(input.tools.send.approval_mode).toBe('approve')
  })

  it('retains stricter review, enforces a human reviewer and blocks annotated destructive tools for read-only bots', () => {
    expect(appPolicy({ default_tools_approval_mode: 'prompt', approvals_reviewer: 'auto_review', destructive_enabled: true }, true, true))
      .toMatchObject({ enabled: true, default_tools_approval_mode: 'prompt', approvals_reviewer: 'user', destructive_enabled: false })
    expect(appPolicy({ destructive_enabled: false }, false, false)).toMatchObject({ enabled: false, destructive_enabled: false })
  })

  it('also overrides per-account automatic review without weakening stricter prompts', () => {
    expect(appPolicy({ links: {
      first: { approvals_reviewer: 'auto_review', default_tools_approval_mode: 'approve' },
      second: { default_tools_approval_mode: 'prompt' }
    } }, true, true).links).toEqual({
      first: { approvals_reviewer: 'user', default_tools_approval_mode: 'writes' },
      second: { approvals_reviewer: 'user', default_tools_approval_mode: 'prompt' }
    })
  })
})
