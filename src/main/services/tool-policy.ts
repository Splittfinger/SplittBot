// Provider annotations are not an isolation boundary. These runtime policies
// ensure that inherited "approve" overrides cannot silently bypass user review
// for writes. Explicitly stricter "prompt" policies and disabled tools survive.
export function withUserToolApprovals(config: Record<string, unknown>): Record<string, unknown> {
  const configuredTools = isRecord(config.tools) ? config.tools : {}
  return {
    ...config,
    default_tools_approval_mode: config.default_tools_approval_mode === 'prompt' ? 'prompt' : 'writes',
    tools: Object.fromEntries(Object.entries(configuredTools).map(([name, value]) => {
      const tool = isRecord(value) ? value : {}
      return [name, { ...tool, approval_mode: tool.approval_mode === 'prompt' ? 'prompt' : 'writes' }]
    }))
  }
}

export function appPolicy(config: Record<string, unknown>, enabled: boolean, readOnly: boolean): Record<string, unknown> {
  const links = isRecord(config.links) ? config.links : {}
  return {
    ...withUserToolApprovals(config),
    enabled,
    approvals_reviewer: 'user',
    links: Object.fromEntries(Object.entries(links).map(([id, value]) => {
      const link = isRecord(value) ? value : {}
      return [id, { ...link, approvals_reviewer: 'user', default_tools_approval_mode: link.default_tools_approval_mode === 'prompt' ? 'prompt' : 'writes' }]
    })),
    ...(readOnly ? { destructive_enabled: false } : {})
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
