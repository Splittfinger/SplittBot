export type AgentAccessMode = 'readOnly' | 'workspaceWrite'
export type AgentStatus = 'active' | 'archived'
export type RunStatus = 'queued' | 'running' | 'waitingApproval' | 'completed' | 'failed' | 'cancelled'
export type ApprovalStatus = 'pending' | 'approved' | 'declined' | 'cancelled' | 'expired'

export interface AgentGrants {
  readableRoots: string[]
  writableRoots: string[]
  allowedCommands: string[]
  allowedApps: string[]
  allowedConnectors: string[]
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

export interface AccountStatus {
  state: 'authenticated' | 'signedOut' | 'unavailable'
  authMode: string | null
  email: string | null
  planType: string | null
  requiresOpenaiAuth: boolean
  runtimeSource: string | null
  runtimeVersion: string | null
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

export type ConnectorInput =
  | { name: string; transport: 'stdio'; command: string; args: string[] }
  | { name: string; transport: 'streamableHttp'; url: string }

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
export type RoutineSchedule =
  | { kind: 'interval'; intervalMinutes: number }
  | { kind: 'daily'; timeOfDay: string; daysOfWeek: number[] }

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
  audit: AuditEvent[]
  connectors: Connector[]
  skills: SkillCatalogItem[]
  shortcuts: LocalShortcut[]
  routines: Routine[]
  routineAttempts: RoutineAttempt[]
  notifications: NotificationRecord[]
  memories: AgentMemory[]
  acceptance: AcceptanceCheck[]
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
  agents: {
    create: (input: AgentInput) => Promise<Agent>
    update: (id: string, input: AgentInput) => Promise<Agent>
    archive: (id: string) => Promise<void>
  }
  chat: {
    chooseImages: () => Promise<ChatImageAttachment[]>
    send: (agentId: string, message: string, attachmentIds?: string[]) => Promise<{ runId: string }>
    cancel: (runId: string) => Promise<void>
  }
  approvals: {
    resolve: (approvalId: string, decision: 'approve' | 'decline' | 'cancel') => Promise<void>
    ask: (approvalId: string, question: string) => Promise<void>
    editAndApprove: (approvalId: string, input: string) => Promise<void>
  }
  connectors: {
    refresh: () => Promise<void>
    add: (input: ConnectorInput) => Promise<void>
    update: (name: string, input: ConnectorInput) => Promise<void>
    remove: (name: string) => Promise<void>
    setEnabled: (name: string, enabled: boolean) => Promise<void>
    login: (name: string) => Promise<{ authorizationUrl: string }>
    logout: (name: string) => Promise<void>
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
    openExternal: (url: string) => Promise<void>
    revealPath: (path: string) => Promise<void>
    getVersion: () => Promise<string>
  }
  events: {
    subscribe: (listener: (event: AppEvent) => void) => () => void
  }
}
