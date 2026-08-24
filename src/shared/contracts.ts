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
  request: Record<string, unknown>
  status: ApprovalStatus
  decision: string | null
  createdAt: string
  resolvedAt: string | null
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
  error: string | null
}

export type ConnectorInput =
  | { name: string; transport: 'stdio'; command: string; args: string[] }
  | { name: string; transport: 'streamableHttp'; url: string }

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
  approvals: Approval[]
  artifacts: Artifact[]
  audit: AuditEvent[]
  connectors: Connector[]
  skills: SkillCatalogItem[]
  shortcuts: LocalShortcut[]
  routines: Routine[]
  routineAttempts: RoutineAttempt[]
  notifications: NotificationRecord[]
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
    send: (agentId: string, message: string) => Promise<{ runId: string }>
    cancel: (runId: string) => Promise<void>
  }
  approvals: {
    resolve: (approvalId: string, decision: 'approve' | 'decline' | 'cancel') => Promise<void>
  }
  connectors: {
    refresh: () => Promise<void>
    add: (input: ConnectorInput) => Promise<void>
    setEnabled: (name: string, enabled: boolean) => Promise<void>
    login: (name: string) => Promise<{ authorizationUrl: string }>
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
  artifacts: {
    create: (input: { agentId: string; runId?: string | null; name: string; content: string }) => Promise<Artifact>
  }
  avatars: {
    choose: () => Promise<{ dataUrl: string } | null>
  }
  auth: {
    refresh: () => Promise<{ account: AccountStatus; models: CodexModel[] }>
    signIn: () => Promise<{ loginId: string; authUrl: string }>
    signOut: () => Promise<void>
  }
  app: {
    openExternal: (url: string) => Promise<void>
    revealPath: (path: string) => Promise<void>
  }
  events: {
    subscribe: (listener: (event: AppEvent) => void) => () => void
  }
}
