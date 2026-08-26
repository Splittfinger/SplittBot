import { friendlyIdentifierTitle } from './skill-display-name'

const CONNECTOR_ALIASES: Record<string, string> = {
  'cloudflare-api': 'Cloudflare Account Connector',
  codex_app: 'Codex App Tools',
  codex_apps: 'Connected Apps & Services',
  'computer-history': 'Computer Activity History',
  'computer-use': 'Mac Computer Control',
  dataanalyticswidgets: 'Data Analytics Visuals',
  node_repl: 'Browser & App Automation Runtime'
}

export interface ConnectorNameSource {
  name: string
  serverInfo?: Record<string, unknown> | null
}

export function resolveConnectorDisplayName(connector: ConnectorNameSource): string {
  const technicalName = connector.name.trim()
  const alias = CONNECTOR_ALIASES[technicalName.toLocaleLowerCase()]
  if (alias) return alias

  const metadataName = connector.serverInfo
    ? [connector.serverInfo.displayName, connector.serverInfo.title, connector.serverInfo.name]
        .find((value): value is string => typeof value === 'string' && validDisplayName(value) && normalized(value) !== normalized(technicalName))
    : undefined
  if (metadataName) return metadataName.trim()

  return friendlyIdentifierTitle(technicalName) || 'Unnamed Connector'
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')
}

function validDisplayName(value: string): boolean {
  const trimmed = value.trim()
  return Boolean(trimmed && trimmed.length <= 80 && !/[\u0000-\u001f\u007f]/.test(trimmed))
}
