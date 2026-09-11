export type AgentAccessMode = 'readOnly' | 'workspaceWrite'
export type AgentStatus = 'active' | 'archived'
export type RunStatus = 'queued' | 'running' | 'waitingApproval' | 'completed' | 'failed' | 'cancelled'
export type ApprovalStatus = 'pending' | 'approved' | 'declined' | 'cancelled' | 'expired'

export interface AgentGrants {
  readableRoots: string[]
  writableRoots: string[]
  allowedCommands: string[]
  allowedApps: string[]
  allowedConnectedApps: string[]
  allowedConnectors: string[]
  allowedConnectorAccounts: string[]
  allowedSkillPaths: string[]
  allowedShortcuts: string[]
  networkAccess: boolean
}

export interface AgentAvatar {
  type: 'initials' | 'emoji' | 'image'
  value: string | null
}

export interface Agent {
  id: string
  name: string
  role: string
  instructions: string
  color: string
  status: AgentStatus
  model: string | null
  reasoningEffort: string | null
  avatar: AgentAvatar
  collaboratorIds: string[]
  cwd: string
  accessMode: AgentAccessMode
  threadId: string | null
  memoryMode: 'enabled' | 'disabled'
  memoryRetentionDays: number | null
  grants: AgentGrants
  createdAt: string
  updatedAt: string
}

export interface AgentInput {
  name: string
  role: string
  instructions: string
  color: string
  model?: string | null
  reasoningEffort?: string | null
  avatar: AgentAvatar
  collaboratorIds: string[]
  cwd: string
  accessMode: AgentAccessMode
  grants: AgentGrants
}

export interface Message {
  id: string
  agentId: string
  runId: string | null
  role: 'user' | 'assistant' | 'system'
  kind: 'text' | 'status' | 'error'
  content: string
  createdAt: string
}

export interface ChatImageAttachment {
  id: string
  type: 'image'
  name: string
  size: number
}

export interface Run {
  id: string
  agentId: string
  threadId: string | null
  turnId: string | null
  status: RunStatus
  input: string
  output: string | null
  error: string | null
  startedAt: string
  completedAt: string | null
}

export interface Approval {
  id: string
  agentId: string | null
  runId: string | null
  requestId: string
  method: string
  title: string
  summary: string
  impact: ApprovalImpact
  request: Record<string, unknown>
  status: ApprovalStatus
  decision: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface ApprovalImpact {
  targetResource: string
  dataLeavingMac: string
  reversibility: string
  afterApproval: string
  editableFields: string[]
}

export interface Artifact {
  id: string
  agentId: string
  runId: string | null
  name: string
  kind: 'response' | 'file' | 'note'
  content: string
  path: string | null
  createdAt: string
}

export type ActionItemType = 'decision' | 'task' | 'followUp' | 'risk'
export type ActionItemStatus = 'inbox' | 'next' | 'waiting' | 'scheduled' | 'blocked' | 'done' | 'dismissed'
export type ActionItemPriority = 'urgent' | 'high' | 'normal' | 'low'
export type ActionRecipe = 'recommend' | 'investigate' | 'draft' | 'meeting' | 'moveForward'

export interface ActionEvidence {
  runId: string | null
  excerpt: string
  observedAt: string
}

export interface ActionItem {
  id: string
  title: string
  summary: string
  type: ActionItemType
  status: ActionItemStatus
  priority: ActionItemPriority
  ownerAgentId: string | null
  sourceAgentId: string
  sourceRunId: string | null
  sourceRoutineId: string | null
  sourceAccountId: string | null
  workspaceId: string | null
  dueAt: string | null
  firstSeenAt: string
  lastSeenAt: string
  fingerprint: string
  evidence: ActionEvidence[]
  resolution: string | null
  createdBy: 'agent' | 'user'
}

export interface ActionItemCreateInput {
  title: string
  summary: string
  type: ActionItemType
  priority: ActionItemPriority
  ownerAgentId?: string | null
  sourceAgentId: string
  sourceRunId?: string | null
  workspaceId?: string | null
  dueAt?: string | null
  evidence?: string | null
}

export interface ActionItemUpdateInput {
  title?: string
  summary?: string
  type?: ActionItemType
  status?: ActionItemStatus
  priority?: ActionItemPriority
  ownerAgentId?: string | null
  workspaceId?: string | null
  dueAt?: string | null
  resolution?: string | null
}

export interface ActionEvent {
  id: string
  actionId: string
  runId: string | null
  actor: 'user' | 'agent' | 'system'
  type: 'created' | 'observed' | 'updated' | 'assigned' | 'statusChanged' | 'suggestionStarted' | 'resolved' | 'dismissed' | 'reopened'
  summary: string
  detail: Record<string, unknown>
  createdAt: string
}

export interface AuditEvent {
  id: string
  type: string
  actor: 'user' | 'agent' | 'system'
  agentId: string | null
  runId: string | null
  summary: string
  detail: Record<string, unknown>
  createdAt: string
}

export type HandoffStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface Handoff {
  id: string
  parentRunId: string
  fromAgentId: string
  toAgentId: string
  status: HandoffStatus
  prompt: string
  result: string | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

export interface CodexModel {
  id: string
  isDefault: boolean
  displayName: string
  description: string | null
  defaultReasoningEffort: string | null
  supportedReasoningEfforts: string[]
}

export interface AccountUsageWindow {
  usedPercent: number
  windowDurationMinutes: number | null
  resetsAt: number | null
}

export interface AccountUsageCredits {
  hasCredits: boolean
  unlimited: boolean
  balance: string | null
}

export interface AccountUsageBucket {
  id: string
  name: string | null
  planType: string | null
  primary: AccountUsageWindow | null
  secondary: AccountUsageWindow | null
  credits: AccountUsageCredits | null
  limitReachedReason: string | null
  spendControlReached: boolean | null
}

export interface AccountUsageStatus {
  state: 'available' | 'unavailable'
  buckets: AccountUsageBucket[]
  resetCreditsAvailable: number | null
  fetchedAt: string | null
  error: string | null
}

export interface AccountStatus {
  state: 'authenticated' | 'signedOut' | 'unavailable'
  authMode: string | null
  email: string | null
  planType: string | null
  requiresOpenaiAuth: boolean
  runtimeSource: string | null
  runtimeVersion: string | null
  runtimeBundled: boolean
  runtimeHome: string | null
  usage: AccountUsageStatus
  error: string | null
}

export type ConnectorAuthStatus = 'unknown' | 'unsupported' | 'notLoggedIn' | 'bearerToken' | 'oAuth'

export interface Connector {
  name: string
  displayName: string
  pluginId: string | null
  authStatus: ConnectorAuthStatus
  enabled: boolean
  canGrant: boolean
  toolCount: number
  resourceCount: number
  userConfigured: boolean
  transport: 'stdio' | 'streamableHttp' | 'runtime'
  endpoint: string | null
  args: string[]
  error: string | null
}

export interface ConnectedApp {
  id: string
  name: string
  slug: string
  description: string
  installUrl: string | null
  isAccessible: boolean
  isEnabled: boolean
  runtimeName: string | null
  runtimeEnabled: boolean
  callable: boolean
}

export type ConnectorInput =
  | { name: string; transport: 'stdio'; command: string; args: string[] }
  | { name: string; transport: 'streamableHttp'; url: string }

export interface ConnectorAccount {
  id: string
  connectorName: string
  connectorDisplayName: string
  runtimeName: string
  label: string
  accountIdentifier: string | null
  authStatus: ConnectorAuthStatus
  enabled: boolean
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface ConnectorAccountInput {
  connectorName: string
  label: string
  accountIdentifier?: string | null
}

export interface Workspace {
  id: string
  name: string
  objective: string
  status: 'active' | 'completed' | 'archived'
  currentOwnerAgentId: string
  memberIds: string[]
  autoCoordinate: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkspaceInput {
  name: string
  objective: string
  currentOwnerAgentId: string
  memberIds: string[]
  autoCoordinate: boolean
}

export interface WorkspaceEvent {
  id: string
  workspaceId: string
  runId: string | null
  agentId: string | null
  type: 'created' | 'updated' | 'task' | 'handoff' | 'contribution' | 'ownerChanged' | 'completed' | 'note'
  summary: string
  detail: Record<string, unknown>
  createdAt: string
}

export interface AgentMemory {
  id: string
  agentId: string
  content: string
  source: 'user' | 'agent'
  createdAt: string
}

export interface AgentMemoryPolicyInput {
  mode: 'enabled' | 'disabled'
  retentionDays: number | null
}

export interface AcceptanceCheck {
  key: 'runtime' | 'permissions' | 'imessage' | 'oauth' | 'sleepWake'
  label: string
  status: 'notRun' | 'passed' | 'failed' | 'blocked'
  detail: string
  evidence: string | null
  checkedAt: string | null
}

export type SkillReviewStatus = 'unreviewed' | 'reviewed' | 'blocked'

export interface SkillCatalogItem {
  name: string
  displayName: string
  description: string
  path: string
  scope: string
  enabled: boolean
  reviewStatus: SkillReviewStatus
  reviewNotes: string | null
  dependencies: string[]
}

export type RoutineStatus = 'active' | 'paused'
export type RoutineCatchUpPolicy = 'skip' | 'runOnce'
export type RoutineNotifyPolicy = 'always' | 'failure' | 'never'
export type RoutineSchedule = (
  | { kind: 'interval'; intervalMinutes: number }
  | { kind: 'daily'; timeOfDay: string; daysOfWeek: number[] }
) & { stopAfterDate?: string }

export interface Routine {
  id: string
  agentId: string
  title: string
  prompt: string
  schedule: RoutineSchedule
  status: RoutineStatus
  catchUpPolicy: RoutineCatchUpPolicy
  maxRetries: number
  retryDelayMinutes: number
  notifyPolicy: RoutineNotifyPolicy
  skillPath: string | null
  nextRunAt: string
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RoutineInput {
  agentId: string
  title: string
  prompt: string
  schedule: RoutineSchedule
  catchUpPolicy: RoutineCatchUpPolicy
  maxRetries: number
  retryDelayMinutes: number
  notifyPolicy: RoutineNotifyPolicy
  skillPath?: string | null
}

export type RoutineAttemptStatus = 'queued' | 'running' | 'completed' | 'failed' | 'missed'

export interface RoutineAttempt {
  id: string
  routineId: string
  runId: string | null
  attemptNo: number
  status: RoutineAttemptStatus
  scheduledFor: string
  retryAt: string | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

export interface NotificationRecord {
  id: string
  type: 'routineCompleted' | 'routineFailed' | 'routineMissed' | 'approval'
  title: string
  body: string
  agentId: string | null
  runId: string | null
  read: boolean
  createdAt: string
}

export interface LocalShortcut {
  name: string
  grantedAgentCount: number
}

export type ImportSourceKind = 'codexThread' | 'codexAutomation'

export interface ImportCandidate {
  key: string
  sourceKind: ImportSourceKind
  sourceId: string
  name: string
  summary: string
  status: string
  cwd: string | null
  model: string | null
  updatedAt: string | null
  scheduleLabel: string | null
  targetThreadId: string | null
}

export interface ImportedSourceMonitor {
  sourceKey: string
  sourceKind: ImportSourceKind
  sourceId: string
  name: string
  targetKind: 'agent' | 'monitor'
  targetId: string | null
  status: string
  detail: Record<string, unknown>
  sourceUpdatedAt: string | null
  lastSeenAt: string | null
  createdAt: string
}

export interface ImportCatalog {
  candidates: ImportCandidate[]
  monitored: ImportedSourceMonitor[]
  checkedAt: string | null
  sourceHome: string
  cloudScheduledTasks: {
    state: 'notExposed'
    detail: string
  }
  error: string | null
}

export type GuiPermissionValue = 'granted' | 'denied' | 'notDetermined' | 'restricted' | 'unavailable'

export interface GuiPermissions {
  accessibility: GuiPermissionValue
  screenRecording: GuiPermissionValue
}

export type GuiStep =
  | { type: 'activateApp' }
  | { type: 'wait'; durationMs: number }
  | { type: 'clickElement'; label: string }
  | { type: 'typeText'; text: string }
  | { type: 'pressKey'; key: 'tab' | 'escape' | 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight' }

export interface GuiSessionInput {
  agentId: string
  targetApp: string
  objective: string
  steps: GuiStep[]
  maxRetries: number
}

export type GuiSessionStatus = 'pendingApproval' | 'queued' | 'running' | 'paused' | 'takeover' | 'completed' | 'failed' | 'stopped'

export interface GuiSession {
  id: string
  agentId: string
  approvalId: string | null
  targetApp: string
  objective: string
  steps: GuiStep[]
  maxRetries: number
  planHash: string
  status: GuiSessionStatus
  currentStep: number
  totalSteps: number
  pauseReason: string | null
  error: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export type GuiEvidenceKind = 'before' | 'step' | 'after' | 'paused' | 'failure' | 'stopped'

export interface GuiEvidence {
  id: string
  sessionId: string
  kind: GuiEvidenceKind
  stepIndex: number | null
  summary: string
  path: string
  createdAt: string
}

export interface GuiControlSnapshot {
  permissions: GuiPermissions
  emergencyStopped: boolean
  laneOwnerSessionId: string | null
  sessions: GuiSession[]
  evidence: GuiEvidence[]
}

export interface AppSnapshot {
  account: AccountStatus
  models: CodexModel[]
  agents: Agent[]
  messages: Message[]
  runs: Run[]
  handoffs: Handoff[]
  workspaces: Workspace[]
  workspaceEvents: WorkspaceEvent[]
  approvals: Approval[]
  artifacts: Artifact[]
  actions: ActionItem[]
  actionEvents: ActionEvent[]
  audit: AuditEvent[]
  connectedApps: ConnectedApp[]
  connectors: Connector[]
  connectorAccounts: ConnectorAccount[]
  skills: SkillCatalogItem[]
  shortcuts: LocalShortcut[]
  routines: Routine[]
  routineAttempts: RoutineAttempt[]
  notifications: NotificationRecord[]
  memories: AgentMemory[]
  acceptance: AcceptanceCheck[]
  imports: ImportCatalog
  gui: GuiControlSnapshot
  integrationError: string | null
}

export type AppEvent =
  | { type: 'data:changed' }
  | { type: 'account:changed' }
  | { type: 'run:started'; runId: string; agentId: string }
  | { type: 'run:delta'; runId: string; agentId: string; delta: string }
  | { type: 'run:plan'; runId: string; agentId: string; plan: unknown }
  | { type: 'run:completed'; runId: string; agentId: string; status: RunStatus }
  | { type: 'approval:requested'; approvalId: string }
  | { type: 'gui:changed'; sessionId: string | null }
  | { type: 'runtime:warning'; message: string }

export interface DesktopApi {
  bootstrap: (agentId?: string) => Promise<AppSnapshot>
  runs: { get: (id: string) => Promise<Run | null> }
  agents: {
    create: (input: AgentInput) => Promise<Agent>
    update: (id: string, input: AgentInput) => Promise<Agent>
    setConnectedAppGrant: (id: string, appId: string, granted: boolean) => Promise<Agent>
    archive: (id: string) => Promise<void>
  }
  chat: {
    listMessages: (agentId: string) => Promise<Message[]>
    chooseImages: () => Promise<ChatImageAttachment[]>
    send: (agentId: string, message: string, attachmentIds?: string[]) => Promise<{ runId: string }>
    cancel: (runId: string) => Promise<void>
  }
  approvals: {
    resolve: (approvalId: string, decision: 'approve' | 'decline' | 'cancel') => Promise<void>
    ask: (approvalId: string, question: string) => Promise<void>
    editAndApprove: (approvalId: string, input: string) => Promise<void>
  }
  actions: {
    create: (input: ActionItemCreateInput) => Promise<ActionItem>
    update: (id: string, input: ActionItemUpdateInput) => Promise<ActionItem>
    start: (id: string, recipe: ActionRecipe) => Promise<{ runId: string; agentId: string }>
  }
  connectors: {
    refresh: () => Promise<void>
    add: (input: ConnectorInput) => Promise<void>
    update: (name: string, input: ConnectorInput) => Promise<void>
    remove: (name: string) => Promise<void>
    setEnabled: (name: string, enabled: boolean) => Promise<void>
    login: (name: string) => Promise<{ authorizationUrl: string }>
    logout: (name: string) => Promise<void>
    addAccount: (input: ConnectorAccountInput) => Promise<{ account: ConnectorAccount; authorizationUrl: string }>
    loginAccount: (id: string) => Promise<{ authorizationUrl: string }>
    logoutAccount: (id: string) => Promise<void>
    removeAccount: (id: string) => Promise<void>
  }
  workspaces: {
    create: (input: WorkspaceInput) => Promise<Workspace>
    update: (id: string, input: WorkspaceInput) => Promise<Workspace>
    setStatus: (id: string, status: Workspace['status']) => Promise<void>
    startTask: (id: string, prompt: string) => Promise<{ runId: string }>
  }
  memories: {
    add: (agentId: string, content: string) => Promise<AgentMemory>
    setPolicy: (agentId: string, input: AgentMemoryPolicyInput) => Promise<void>
    delete: (id: string) => Promise<void>
    clear: (agentId: string) => Promise<void>
    deleteThread: (agentId: string) => Promise<void>
    export: (agentId: string) => Promise<{ path: string } | null>
  }
  skills: {
    refresh: () => Promise<void>
    review: (path: string, status: SkillReviewStatus, notes?: string | null) => Promise<void>
    setEnabled: (path: string, enabled: boolean) => Promise<void>
  }
  routines: {
    create: (input: RoutineInput) => Promise<Routine>
    update: (id: string, input: RoutineInput) => Promise<Routine>
    setStatus: (id: string, status: RoutineStatus) => Promise<void>
    runNow: (id: string) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  imports: {
    refresh: () => Promise<ImportCatalog>
    add: (candidateKeys: string[]) => Promise<ImportCatalog>
  }
  notifications: {
    markRead: (id: string) => Promise<void>
    markAllRead: () => Promise<void>
  }
  shortcuts: {
    prepare: (agentId: string, name: string, input: string) => Promise<Approval>
  }
  gui: {
    refreshPermissions: () => Promise<GuiPermissions>
    requestPermission: (kind: 'accessibility' | 'screenRecording') => Promise<GuiPermissions>
    openPermissionSettings: (kind: 'accessibility' | 'screenRecording') => Promise<void>
    prepare: (input: GuiSessionInput) => Promise<Approval>
    pause: (sessionId: string) => Promise<void>
    resume: (sessionId: string) => Promise<void>
    takeover: (sessionId: string) => Promise<void>
    emergencyStop: () => Promise<void>
    resetEmergencyStop: () => Promise<void>
    evidenceDataUrl: (evidenceId: string) => Promise<string>
  }
  acceptance: {
    refreshPermissions: () => Promise<void>
    exerciseIMessage: () => Promise<void>
    exerciseWakeCatchUp: () => Promise<void>
    confirmWakeNotification: () => Promise<void>
  }
  artifacts: {
    create: (input: { agentId: string; runId?: string | null; name: string; content: string }) => Promise<Artifact>
    export: (id: string) => Promise<{ path: string } | null>
  }
  avatars: {
    choose: () => Promise<{ dataUrl: string } | null>
  }
  auth: {
    refresh: () => Promise<{ account: AccountStatus; models: CodexModel[] }>
    signIn: () => Promise<{ loginId: string; authUrl: string }>
    signOut: () => Promise<void>
  }
  data: {
    createBackup: () => Promise<{ path: string } | null>
    restoreBackup: () => Promise<{ restored: true } | null>
    revealLocalData: () => Promise<void>
  }
  app: {
    openExternal: (url: string) => Promise<{ browserName: string; forcedBrowser: boolean }>
    revealPath: (path: string) => Promise<void>
    getVersion: () => Promise<string>
    revealInstalledApp: () => Promise<void>
    openFullDiskAccess: () => Promise<void>
  }
  events: {
    subscribe: (listener: (event: AppEvent) => void) => () => void
  }
}
