import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import initSqlJs, { type BindParams, type Database } from 'sql.js'
import type {
  Agent,
  AgentGrants,
  AgentInput,
  AgentMemory,
  AgentMemoryPolicyInput,
  AcceptanceCheck,
  Approval,
  ApprovalStatus,
  Artifact,
  AuditEvent,
  GuiEvidence,
  GuiEvidenceKind,
  GuiSession,
  GuiSessionInput,
  GuiSessionStatus,
  Handoff,
  HandoffStatus,
  Message,
  NotificationRecord,
  Run,
  RunStatus,
  Routine,
  RoutineAttempt,
  RoutineAttemptStatus,
  RoutineInput,
  RoutineStatus,
  SkillReviewStatus,
  Workspace,
  WorkspaceEvent,
  WorkspaceInput
} from '../../shared/contracts'
import { writePrivateFile } from '../services/data-recovery'

type SqlRow = Record<string, unknown>

const require = createRequire(import.meta.url)
const DEFAULT_GRANTS: AgentGrants = {
  readableRoots: [],
  writableRoots: [],
  allowedCommands: [],
  allowedApps: [],
  allowedConnectors: [],
  allowedSkillPaths: [],
  allowedShortcuts: [],
  networkAccess: false
}

export class SqliteStore {
  private constructor(
    private readonly path: string,
    private readonly db: Database
  ) {}

  static async open(path: string): Promise<SqliteStore> {
    const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
    let bytes: Uint8Array | undefined
    if (path !== ':memory:') {
      try {
        bytes = new Uint8Array(await readFile(path))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    const store = new SqliteStore(path, new SQL.Database(bytes))
    store.migrate()
    store.expireInterruptedApprovals()
    await store.persist()
    return store
  }

  close(): void {
    this.db.close()
  }

  async createBackup(destination: string): Promise<string> {
    if (this.path === ':memory:') throw new Error('In-memory test databases cannot be backed up.')
    if (resolve(destination) === resolve(this.path)) throw new Error('Choose a backup location other than the active database.')
    return writePrivateFile(destination, this.db.export())
  }

  private migrate(): void {
    this.db.run(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        instructions TEXT NOT NULL,
        color TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        model TEXT,
        cwd TEXT NOT NULL,
        access_mode TEXT NOT NULL DEFAULT 'readOnly',
        thread_id TEXT,
        grants_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        run_id TEXT,
        role TEXT NOT NULL,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        thread_id TEXT,
        turn_id TEXT,
        status TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT,
        error TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        agent_id TEXT,
        run_id TEXT,
        request_id TEXT NOT NULL,
        method TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        request_json TEXT NOT NULL,
        status TEXT NOT NULL,
        decision TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        run_id TEXT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        path TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        actor TEXT NOT NULL,
        agent_id TEXT,
        run_id TEXT,
        summary TEXT NOT NULL,
        detail_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS handoffs (
        id TEXT PRIMARY KEY,
        parent_run_id TEXT NOT NULL REFERENCES runs(id),
        from_agent_id TEXT NOT NULL REFERENCES agents(id),
        to_agent_id TEXT NOT NULL REFERENCES agents(id),
        status TEXT NOT NULL,
        prompt TEXT NOT NULL,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS skill_reviews (
        path TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        notes TEXT,
        reviewed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        schedule_json TEXT NOT NULL,
        status TEXT NOT NULL,
        catch_up_policy TEXT NOT NULL,
        max_retries INTEGER NOT NULL,
        retry_delay_minutes INTEGER NOT NULL,
        notify_policy TEXT NOT NULL,
        skill_path TEXT,
        next_run_at TEXT NOT NULL,
        last_run_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routine_attempts (
        id TEXT PRIMARY KEY,
        routine_id TEXT NOT NULL REFERENCES routines(id),
        run_id TEXT,
        attempt_no INTEGER NOT NULL,
        status TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        retry_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        agent_id TEXT,
        run_id TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS gui_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        approval_id TEXT,
        target_app TEXT NOT NULL,
        objective TEXT NOT NULL,
        steps_json TEXT NOT NULL,
        max_retries INTEGER NOT NULL DEFAULT 0,
        plan_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 0,
        total_steps INTEGER NOT NULL,
        pause_reason TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS gui_evidence (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES gui_sessions(id),
        kind TEXT NOT NULL,
        step_index INTEGER,
        summary TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        objective TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_owner_agent_id TEXT NOT NULL REFERENCES agents(id),
        member_ids_json TEXT NOT NULL,
        auto_coordinate INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_events (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        run_id TEXT,
        agent_id TEXT,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        detail_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES agents(id),
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS acceptance_checks (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        status TEXT NOT NULL,
        detail TEXT NOT NULL,
        evidence TEXT,
        checked_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(agent_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_runs_agent ON runs(agent_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_handoffs_parent ON handoffs(parent_run_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_routines_due ON routines(status, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_routine_attempts_retry ON routine_attempts(status, retry_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
      CREATE INDEX IF NOT EXISTS idx_gui_sessions_created ON gui_sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_gui_evidence_session ON gui_evidence(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_workspace_events_workspace ON workspace_events(workspace_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_id, created_at);
    `)
    this.ensureColumn('agents', 'reasoning_effort', 'TEXT')
    this.ensureColumn('agents', 'avatar_type', "TEXT NOT NULL DEFAULT 'initials'")
    this.ensureColumn('agents', 'avatar_value', 'TEXT')
    this.ensureColumn('agents', 'collaborator_ids_json', "TEXT NOT NULL DEFAULT '[]'")
    this.ensureColumn('agents', 'memory_mode', "TEXT NOT NULL DEFAULT 'enabled'")
    this.ensureColumn('agents', 'memory_retention_days', 'INTEGER')
    this.ensureColumn('gui_sessions', 'max_retries', 'INTEGER NOT NULL DEFAULT 0')
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.all(`PRAGMA table_info(${table})`)
    if (!columns.some((entry) => entry.name === column)) this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }

  private expireInterruptedApprovals(): void {
    const now = new Date().toISOString()
    this.db.run(
      `UPDATE approvals SET status = 'expired', decision = 'app-restarted', resolved_at = ? WHERE status = 'pending'`,
      [now]
    )
    this.db.run(
      `UPDATE runs SET status = 'failed', error = 'The app restarted before this run completed.', completed_at = ? WHERE status IN ('queued', 'running', 'waitingApproval')`,
      [now]
    )
    this.db.run(
      `UPDATE routine_attempts SET status = 'failed', error = 'The app restarted before this attempt completed.', completed_at = ? WHERE status = 'running'`,
      [now]
    )
    this.db.run(
      `UPDATE gui_sessions SET status = 'stopped', error = 'The app restarted before this GUI session completed.', completed_at = ? WHERE status IN ('pendingApproval', 'queued', 'running', 'paused')`,
      [now]
    )
  }

  private all(sql: string, params: BindParams = []): SqlRow[] {
    const statement = this.db.prepare(sql)
    try {
      statement.bind(params)
      const rows: SqlRow[] = []
      while (statement.step()) rows.push(statement.getAsObject() as SqlRow)
      return rows
    } finally {
      statement.free()
    }
  }

  private one(sql: string, params: BindParams = []): SqlRow | null {
    return this.all(sql, params)[0] ?? null
  }

  private async persist(): Promise<void> {
    if (this.path === ':memory:') return
    await mkdir(dirname(this.path), { recursive: true })
    const temporaryPath = `${this.path}.next`
    await writeFile(temporaryPath, Buffer.from(this.db.export()))
    await rename(temporaryPath, this.path)
  }

  private async mutate(sql: string, params: BindParams = []): Promise<void> {
    this.db.run(sql, params)
    await this.persist()
  }

  async ensureSeedAgent(cwd: string): Promise<void> {
    if (this.one(`SELECT id FROM agents LIMIT 1`)) return
    await this.createAgent({
      name: 'Atlas',
      role: 'Chief of Staff',
      instructions: 'Turn approved sources into concise, evidence-linked briefs. Draft first and ask before consequential actions.',
      color: '#7657d8',
      model: null,
      reasoningEffort: null,
      avatar: { type: 'initials', value: null },
      collaboratorIds: [],
      cwd,
      accessMode: 'readOnly',
      grants: { ...DEFAULT_GRANTS, readableRoots: [cwd] }
    })
  }

  listAgents(includeArchived = false): Agent[] {
    const where = includeArchived ? '' : `WHERE status = 'active'`
    return this.all(`SELECT * FROM agents ${where} ORDER BY created_at ASC`).map(mapAgent)
  }

  getAgent(id: string): Agent | null {
    const row = this.one(`SELECT * FROM agents WHERE id = ?`, [id])
    return row ? mapAgent(row) : null
  }

  async createAgent(input: AgentInput): Promise<Agent> {
    const now = new Date().toISOString()
    const id = randomUUID()
    await this.mutate(
      `INSERT INTO agents (id, name, role, instructions, color, status, model, reasoning_effort, avatar_type, avatar_value, collaborator_ids_json, cwd, access_mode, thread_id, grants_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [id, input.name, input.role, input.instructions, input.color, input.model ?? null, input.reasoningEffort ?? null, input.avatar.type, input.avatar.value, JSON.stringify(input.collaboratorIds), input.cwd, input.accessMode, JSON.stringify(input.grants), now, now]
    )
    return this.getAgent(id)!
  }

  async updateAgent(id: string, input: AgentInput): Promise<Agent> {
    await this.mutate(
      `UPDATE agents SET name = ?, role = ?, instructions = ?, color = ?, model = ?, reasoning_effort = ?, avatar_type = ?, avatar_value = ?, collaborator_ids_json = ?, cwd = ?, access_mode = ?, grants_json = ?, updated_at = ? WHERE id = ?`,
      [input.name, input.role, input.instructions, input.color, input.model ?? null, input.reasoningEffort ?? null, input.avatar.type, input.avatar.value, JSON.stringify(input.collaboratorIds), input.cwd, input.accessMode, JSON.stringify(input.grants), new Date().toISOString(), id]
    )
    const agent = this.getAgent(id)
    if (!agent) throw new Error('Agent not found')
    return agent
  }

  async setAgentThread(id: string, threadId: string | null): Promise<void> {
    await this.mutate(`UPDATE agents SET thread_id = ?, updated_at = ? WHERE id = ?`, [threadId, new Date().toISOString(), id])
  }

  async archiveAgent(id: string): Promise<void> {
    await this.mutate(`UPDATE agents SET status = 'archived', updated_at = ? WHERE id = ?`, [new Date().toISOString(), id])
  }

  async setAgentMemoryPolicy(id: string, input: AgentMemoryPolicyInput): Promise<void> {
    await this.mutate(
      `UPDATE agents SET memory_mode = ?, memory_retention_days = ?, updated_at = ? WHERE id = ?`,
      [input.mode, input.retentionDays, new Date().toISOString(), id]
    )
  }

  async removeConnectorGrant(name: string): Promise<void> {
    this.db.run('BEGIN')
    try {
      for (const agent of this.listAgents(true)) {
        if (!agent.grants.allowedConnectors.includes(name)) continue
        const grants = { ...agent.grants, allowedConnectors: agent.grants.allowedConnectors.filter((entry) => entry !== name) }
        this.db.run(`UPDATE agents SET grants_json = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(grants), new Date().toISOString(), agent.id])
      }
      this.db.run('COMMIT')
      await this.persist()
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  listMessages(agentId?: string, limit = 300): Message[] {
    const rows = agentId
      ? this.all(`SELECT * FROM messages WHERE agent_id = ? ORDER BY created_at ASC LIMIT ?`, [agentId, limit])
      : this.all(`SELECT * FROM messages ORDER BY created_at DESC LIMIT ?`, [limit]).reverse()
    return rows.map(mapMessage)
  }

  async addMessage(input: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const message: Message = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
    await this.mutate(
      `INSERT INTO messages (id, agent_id, run_id, role, kind, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [message.id, message.agentId, message.runId, message.role, message.kind, message.content, message.createdAt]
    )
    return message
  }

  listRuns(limit = 100): Run[] {
    return this.all(`SELECT * FROM runs ORDER BY started_at DESC LIMIT ?`, [limit]).map(mapRun)
  }

  getRun(id: string): Run | null {
    const row = this.one(`SELECT * FROM runs WHERE id = ?`, [id])
    return row ? mapRun(row) : null
  }

  async createRun(agentId: string, input: string): Promise<Run> {
    const run: Run = {
      id: randomUUID(), agentId, threadId: null, turnId: null, status: 'queued', input,
      output: null, error: null, startedAt: new Date().toISOString(), completedAt: null
    }
    await this.mutate(
      `INSERT INTO runs (id, agent_id, thread_id, turn_id, status, input, output, error, started_at, completed_at) VALUES (?, ?, NULL, NULL, ?, ?, NULL, NULL, ?, NULL)`,
      [run.id, run.agentId, run.status, run.input, run.startedAt]
    )
    return run
  }

  async updateRun(id: string, patch: Partial<Pick<Run, 'threadId' | 'turnId' | 'status' | 'output' | 'error' | 'completedAt'>>): Promise<void> {
    const current = this.getRun(id)
    if (!current) throw new Error('Run not found')
    const next = { ...current, ...patch }
    await this.mutate(
      `UPDATE runs SET thread_id = ?, turn_id = ?, status = ?, output = ?, error = ?, completed_at = ? WHERE id = ?`,
      [next.threadId, next.turnId, next.status, next.output, next.error, next.completedAt, id]
    )
  }

  listHandoffs(limit = 200): Handoff[] {
    return this.all(`SELECT * FROM handoffs ORDER BY created_at DESC LIMIT ?`, [limit]).map(mapHandoff)
  }

  async createHandoff(input: Pick<Handoff, 'parentRunId' | 'fromAgentId' | 'toAgentId' | 'prompt'>): Promise<Handoff> {
    const handoff: Handoff = {
      ...input,
      id: randomUUID(),
      status: 'queued',
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null
    }
    await this.mutate(
      `INSERT INTO handoffs (id, parent_run_id, from_agent_id, to_agent_id, status, prompt, result, error, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)`,
      [handoff.id, handoff.parentRunId, handoff.fromAgentId, handoff.toAgentId, handoff.status, handoff.prompt, handoff.createdAt]
    )
    return handoff
  }

  async updateHandoff(id: string, patch: Partial<Pick<Handoff, 'status' | 'result' | 'error' | 'completedAt'>>): Promise<void> {
    const current = this.one(`SELECT * FROM handoffs WHERE id = ?`, [id])
    if (!current) throw new Error('Handoff not found')
    const next = { ...mapHandoff(current), ...patch }
    await this.mutate(
      `UPDATE handoffs SET status = ?, result = ?, error = ?, completed_at = ? WHERE id = ?`,
      [next.status, next.result, next.error, next.completedAt, id]
    )
  }

  listWorkspaces(includeArchived = false): Workspace[] {
    const where = includeArchived ? '' : `WHERE status != 'archived'`
    return this.all(`SELECT * FROM workspaces ${where} ORDER BY updated_at DESC`).map(mapWorkspace)
  }

  getWorkspace(id: string): Workspace | null {
    const row = this.one(`SELECT * FROM workspaces WHERE id = ?`, [id])
    return row ? mapWorkspace(row) : null
  }

  async createWorkspace(input: WorkspaceInput): Promise<Workspace> {
    const id = randomUUID()
    const now = new Date().toISOString()
    await this.mutate(
      `INSERT INTO workspaces (id, name, objective, status, current_owner_agent_id, member_ids_json, auto_coordinate, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      [id, input.name, input.objective, input.currentOwnerAgentId, JSON.stringify(input.memberIds), input.autoCoordinate ? 1 : 0, now, now]
    )
    return this.getWorkspace(id)!
  }

  async updateWorkspace(id: string, input: WorkspaceInput): Promise<Workspace> {
    await this.mutate(
      `UPDATE workspaces SET name = ?, objective = ?, current_owner_agent_id = ?, member_ids_json = ?, auto_coordinate = ?, updated_at = ? WHERE id = ?`,
      [input.name, input.objective, input.currentOwnerAgentId, JSON.stringify(input.memberIds), input.autoCoordinate ? 1 : 0, new Date().toISOString(), id]
    )
    const workspace = this.getWorkspace(id)
    if (!workspace) throw new Error('Workspace not found.')
    return workspace
  }

  async setWorkspaceStatus(id: string, status: Workspace['status']): Promise<void> {
    await this.mutate(`UPDATE workspaces SET status = ?, updated_at = ? WHERE id = ?`, [status, new Date().toISOString(), id])
  }

  listWorkspaceEvents(limit = 500): WorkspaceEvent[] {
    return this.all(`SELECT * FROM workspace_events ORDER BY created_at DESC LIMIT ?`, [limit]).map(mapWorkspaceEvent)
  }

  async addWorkspaceEvent(input: Omit<WorkspaceEvent, 'id' | 'createdAt'>): Promise<WorkspaceEvent> {
    const event: WorkspaceEvent = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
    await this.mutate(
      `INSERT INTO workspace_events (id, workspace_id, run_id, agent_id, type, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.id, event.workspaceId, event.runId, event.agentId, event.type, event.summary, JSON.stringify(event.detail), event.createdAt]
    )
    return event
  }

  listApprovals(limit = 100): Approval[] {
    return this.all(`SELECT * FROM approvals ORDER BY created_at DESC LIMIT ?`, [limit]).map(mapApproval)
  }

  getApproval(id: string): Approval | null {
    const row = this.one(`SELECT * FROM approvals WHERE id = ?`, [id])
    return row ? mapApproval(row) : null
  }

  async createApproval(input: Omit<Approval, 'id' | 'status' | 'decision' | 'createdAt' | 'resolvedAt' | 'impact'>): Promise<Approval> {
    const approval: Approval = {
      ...input, impact: approvalImpact(input.method, input.request), id: randomUUID(), status: 'pending', decision: null,
      createdAt: new Date().toISOString(), resolvedAt: null
    }
    await this.mutate(
      `INSERT INTO approvals (id, agent_id, run_id, request_id, method, title, summary, request_json, status, decision, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, NULL)`,
      [approval.id, approval.agentId, approval.runId, approval.requestId, approval.method, approval.title, approval.summary, JSON.stringify(approval.request), approval.createdAt]
    )
    return approval
  }

  async resolveApproval(id: string, status: ApprovalStatus, decision: string): Promise<void> {
    await this.mutate(`UPDATE approvals SET status = ?, decision = ?, resolved_at = ? WHERE id = ?`, [status, decision, new Date().toISOString(), id])
  }

  async updateApprovalRequest(id: string, request: Record<string, unknown>, summary?: string): Promise<void> {
    if (summary === undefined) await this.mutate(`UPDATE approvals SET request_json = ? WHERE id = ?`, [JSON.stringify(request), id])
    else await this.mutate(`UPDATE approvals SET request_json = ?, summary = ? WHERE id = ?`, [JSON.stringify(request), summary, id])
  }

  listArtifacts(limit = 100): Artifact[] {
    return this.all(`SELECT * FROM artifacts ORDER BY created_at DESC LIMIT ?`, [limit]).map(mapArtifact)
  }

  async createArtifact(input: { agentId: string; runId?: string | null; name: string; content: string; path?: string | null }): Promise<Artifact> {
    const artifact: Artifact = {
      id: randomUUID(), agentId: input.agentId, runId: input.runId ?? null, name: input.name,
      kind: 'response', content: input.content, path: input.path ?? null, createdAt: new Date().toISOString()
    }
    await this.mutate(
      `INSERT INTO artifacts (id, agent_id, run_id, name, kind, content, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [artifact.id, artifact.agentId, artifact.runId, artifact.name, artifact.kind, artifact.content, artifact.path, artifact.createdAt]
    )
    return artifact
  }

  listAudit(limit = 200): AuditEvent[] {
    return this.all(`SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?`, [limit]).map(mapAudit)
  }

  async addAudit(input: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent> {
    const event: AuditEvent = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
    await this.mutate(
      `INSERT INTO audit_events (id, type, actor, agent_id, run_id, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.id, event.type, event.actor, event.agentId, event.runId, event.summary, JSON.stringify(event.detail), event.createdAt]
    )
    return event
  }

  listSkillReviews(): Array<{ path: string; status: SkillReviewStatus; notes: string | null }> {
    return this.all(`SELECT * FROM skill_reviews ORDER BY reviewed_at DESC`).map((row) => ({
      path: String(row.path), status: row.status as SkillReviewStatus, notes: row.notes ? String(row.notes) : null
    }))
  }

  async setSkillReview(path: string, status: SkillReviewStatus, notes: string | null): Promise<void> {
    await this.mutate(
      `INSERT INTO skill_reviews (path, status, notes, reviewed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET status = excluded.status, notes = excluded.notes, reviewed_at = excluded.reviewed_at`,
      [path, status, notes, new Date().toISOString()]
    )
  }

  listRoutines(): Routine[] {
    return this.all(`SELECT * FROM routines ORDER BY created_at DESC`).map(mapRoutine)
  }

  getRoutine(id: string): Routine | null {
    const row = this.one(`SELECT * FROM routines WHERE id = ?`, [id])
    return row ? mapRoutine(row) : null
  }

  listDueRoutines(now: string): Routine[] {
    return this.all(`SELECT * FROM routines WHERE status = 'active' AND next_run_at <= ? ORDER BY next_run_at ASC`, [now]).map(mapRoutine)
  }

  async createRoutine(input: RoutineInput, nextRunAt: string): Promise<Routine> {
    const id = randomUUID()
    const now = new Date().toISOString()
    await this.mutate(
      `INSERT INTO routines (id, agent_id, title, prompt, schedule_json, status, catch_up_policy, max_retries, retry_delay_minutes, notify_policy, skill_path, next_run_at, last_run_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [id, input.agentId, input.title, input.prompt, JSON.stringify(input.schedule), input.catchUpPolicy, input.maxRetries, input.retryDelayMinutes, input.notifyPolicy, input.skillPath ?? null, nextRunAt, now, now]
    )
    return this.getRoutine(id)!
  }

  async updateRoutine(id: string, input: RoutineInput, nextRunAt: string): Promise<Routine> {
    await this.mutate(
      `UPDATE routines SET agent_id = ?, title = ?, prompt = ?, schedule_json = ?, catch_up_policy = ?, max_retries = ?, retry_delay_minutes = ?, notify_policy = ?, skill_path = ?, next_run_at = ?, updated_at = ? WHERE id = ?`,
      [input.agentId, input.title, input.prompt, JSON.stringify(input.schedule), input.catchUpPolicy, input.maxRetries, input.retryDelayMinutes, input.notifyPolicy, input.skillPath ?? null, nextRunAt, new Date().toISOString(), id]
    )
    const routine = this.getRoutine(id)
    if (!routine) throw new Error('Routine not found.')
    return routine
  }

  async setRoutineStatus(id: string, status: RoutineStatus): Promise<void> {
    await this.mutate(`UPDATE routines SET status = ?, updated_at = ? WHERE id = ?`, [status, new Date().toISOString(), id])
  }

  async deleteRoutine(id: string): Promise<void> {
    this.db.run('BEGIN')
    try {
      this.db.run(`DELETE FROM routine_attempts WHERE routine_id = ?`, [id])
      this.db.run(`DELETE FROM routines WHERE id = ?`, [id])
      this.db.run('COMMIT')
      await this.persist()
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  async advanceRoutine(id: string, nextRunAt: string, lastRunAt?: string | null): Promise<void> {
    const current = this.getRoutine(id)
    if (!current) throw new Error('Routine not found.')
    await this.mutate(
      `UPDATE routines SET next_run_at = ?, last_run_at = ?, updated_at = ? WHERE id = ?`,
      [nextRunAt, lastRunAt === undefined ? current.lastRunAt : lastRunAt, new Date().toISOString(), id]
    )
  }

  listRoutineAttempts(limit = 200): RoutineAttempt[] {
    return this.all(`SELECT * FROM routine_attempts ORDER BY COALESCE(started_at, retry_at, scheduled_for) DESC LIMIT ?`, [limit]).map(mapRoutineAttempt)
  }

  listDueRoutineRetries(now: string): RoutineAttempt[] {
    return this.all(`SELECT * FROM routine_attempts WHERE status = 'queued' AND retry_at IS NOT NULL AND retry_at <= ? ORDER BY retry_at ASC`, [now]).map(mapRoutineAttempt)
  }

  async createRoutineAttempt(input: {
    routineId: string
    runId?: string | null
    attemptNo: number
    status: RoutineAttemptStatus
    scheduledFor: string
    retryAt?: string | null
    startedAt?: string | null
    completedAt?: string | null
    error?: string | null
  }): Promise<RoutineAttempt> {
    const id = randomUUID()
    await this.mutate(
      `INSERT INTO routine_attempts (id, routine_id, run_id, attempt_no, status, scheduled_for, retry_at, started_at, completed_at, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.routineId, input.runId ?? null, input.attemptNo, input.status, input.scheduledFor, input.retryAt ?? null, input.startedAt ?? null, input.completedAt ?? null, input.error ?? null]
    )
    return this.listRoutineAttempts(1000).find((attempt) => attempt.id === id)!
  }

  async updateRoutineAttempt(id: string, patch: Partial<Pick<RoutineAttempt, 'runId' | 'status' | 'retryAt' | 'startedAt' | 'completedAt' | 'error'>>): Promise<void> {
    const current = this.one(`SELECT * FROM routine_attempts WHERE id = ?`, [id])
    if (!current) throw new Error('Routine attempt not found.')
    const next = { ...mapRoutineAttempt(current), ...patch }
    await this.mutate(
      `UPDATE routine_attempts SET run_id = ?, status = ?, retry_at = ?, started_at = ?, completed_at = ?, error = ? WHERE id = ?`,
      [next.runId, next.status, next.retryAt, next.startedAt, next.completedAt, next.error, id]
    )
  }

  listNotifications(limit = 200): NotificationRecord[] {
    return this.all(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`, [limit]).map(mapNotification)
  }

  async createNotification(input: Omit<NotificationRecord, 'id' | 'read' | 'createdAt'>): Promise<NotificationRecord> {
    const notification: NotificationRecord = { ...input, id: randomUUID(), read: false, createdAt: new Date().toISOString() }
    await this.mutate(
      `INSERT INTO notifications (id, type, title, body, agent_id, run_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [notification.id, notification.type, notification.title, notification.body, notification.agentId, notification.runId, notification.createdAt]
    )
    return notification
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.mutate(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id])
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.mutate(`UPDATE notifications SET is_read = 1`)
  }

  listAgentMemories(agentId?: string): AgentMemory[] {
    const rows = agentId
      ? this.all(`SELECT * FROM agent_memories WHERE agent_id = ? ORDER BY created_at DESC`, [agentId])
      : this.all(`SELECT * FROM agent_memories ORDER BY created_at DESC`)
    return rows.map(mapAgentMemory)
  }

  getAgentMemory(id: string): AgentMemory | null {
    const row = this.one(`SELECT * FROM agent_memories WHERE id = ?`, [id])
    return row ? mapAgentMemory(row) : null
  }

  async createAgentMemory(agentId: string, content: string, source: AgentMemory['source'] = 'user'): Promise<AgentMemory> {
    const memory: AgentMemory = { id: randomUUID(), agentId, content, source, createdAt: new Date().toISOString() }
    await this.mutate(
      `INSERT INTO agent_memories (id, agent_id, content, source, created_at) VALUES (?, ?, ?, ?, ?)`,
      [memory.id, memory.agentId, memory.content, memory.source, memory.createdAt]
    )
    return memory
  }

  async deleteAgentMemory(id: string): Promise<void> {
    await this.mutate(`DELETE FROM agent_memories WHERE id = ?`, [id])
  }

  async clearAgentMemories(agentId: string): Promise<void> {
    await this.mutate(`DELETE FROM agent_memories WHERE agent_id = ?`, [agentId])
  }

  async pruneAgentMemories(agentId: string, retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString()
    const count = Number(this.one(`SELECT COUNT(*) AS count FROM agent_memories WHERE agent_id = ? AND created_at < ?`, [agentId, cutoff])?.count ?? 0)
    await this.mutate(`DELETE FROM agent_memories WHERE agent_id = ? AND created_at < ?`, [agentId, cutoff])
    return count
  }

  listAcceptanceChecks(): AcceptanceCheck[] {
    return this.all(`SELECT * FROM acceptance_checks ORDER BY key ASC`).map(mapAcceptanceCheck)
  }

  async recordAcceptanceCheck(input: AcceptanceCheck): Promise<void> {
    await this.mutate(
      `INSERT INTO acceptance_checks (key, label, status, detail, evidence, checked_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET label = excluded.label, status = excluded.status, detail = excluded.detail, evidence = excluded.evidence, checked_at = excluded.checked_at`,
      [input.key, input.label, input.status, input.detail, input.evidence, input.checkedAt]
    )
  }

  listGuiSessions(limit = 100): GuiSession[] {
    return this.all(`SELECT * FROM gui_sessions ORDER BY created_at DESC LIMIT ?`, [limit]).map(mapGuiSession)
  }

  getGuiSession(id: string): GuiSession | null {
    const row = this.one(`SELECT * FROM gui_sessions WHERE id = ?`, [id])
    return row ? mapGuiSession(row) : null
  }

  async createGuiSession(input: GuiSessionInput, planHash: string): Promise<GuiSession> {
    const id = randomUUID()
    const createdAt = new Date().toISOString()
    await this.mutate(
      `INSERT INTO gui_sessions (id, agent_id, approval_id, target_app, objective, steps_json, max_retries, plan_hash, status, current_step, total_steps, pause_reason, error, created_at, started_at, completed_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'pendingApproval', 0, ?, NULL, NULL, ?, NULL, NULL)`,
      [id, input.agentId, input.targetApp, input.objective, JSON.stringify(input.steps), input.maxRetries, planHash, input.steps.length, createdAt]
    )
    return this.getGuiSession(id)!
  }

  async setGuiSessionApproval(id: string, approvalId: string): Promise<void> {
    await this.mutate(`UPDATE gui_sessions SET approval_id = ? WHERE id = ?`, [approvalId, id])
  }

  async updateGuiSession(id: string, patch: Partial<Pick<GuiSession, 'status' | 'currentStep' | 'pauseReason' | 'error' | 'startedAt' | 'completedAt'>>): Promise<void> {
    const current = this.getGuiSession(id)
    if (!current) throw new Error('GUI session not found.')
    const next = { ...current, ...patch }
    await this.mutate(
      `UPDATE gui_sessions SET status = ?, current_step = ?, pause_reason = ?, error = ?, started_at = ?, completed_at = ? WHERE id = ?`,
      [next.status, next.currentStep, next.pauseReason, next.error, next.startedAt, next.completedAt, id]
    )
  }

  listGuiEvidence(limit = 300): GuiEvidence[] {
    return this.all(`SELECT * FROM gui_evidence ORDER BY created_at DESC LIMIT ?`, [limit]).map(mapGuiEvidence)
  }

  getGuiEvidence(id: string): GuiEvidence | null {
    const row = this.one(`SELECT * FROM gui_evidence WHERE id = ?`, [id])
    return row ? mapGuiEvidence(row) : null
  }

  async createGuiEvidence(input: Omit<GuiEvidence, 'id' | 'createdAt'>): Promise<GuiEvidence> {
    const evidence: GuiEvidence = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
    await this.mutate(
      `INSERT INTO gui_evidence (id, session_id, kind, step_index, summary, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [evidence.id, evidence.sessionId, evidence.kind, evidence.stepIndex, evidence.summary, evidence.path, evidence.createdAt]
    )
    return evidence
  }

  isGuiEmergencyStopped(): boolean {
    return this.one(`SELECT value FROM app_state WHERE key = 'gui.emergencyStopped'`)?.value === 'true'
  }

  async setGuiEmergencyStopped(stopped: boolean): Promise<void> {
    await this.mutate(
      `INSERT INTO app_state (key, value, updated_at) VALUES ('gui.emergencyStopped', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [String(stopped), new Date().toISOString()]
    )
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

function mapAgent(row: SqlRow): Agent {
  const storedGrants = parseJson<Partial<AgentGrants>>(row.grants_json, {})
  return {
    id: String(row.id), name: String(row.name), role: String(row.role), instructions: String(row.instructions),
    color: String(row.color), status: row.status as Agent['status'], model: row.model ? String(row.model) : null,
    reasoningEffort: row.reasoning_effort ? String(row.reasoning_effort) : null,
    avatar: { type: (row.avatar_type || 'initials') as Agent['avatar']['type'], value: row.avatar_value ? String(row.avatar_value) : null },
    collaboratorIds: parseJson(row.collaborator_ids_json, []),
    cwd: String(row.cwd), accessMode: row.access_mode as Agent['accessMode'], threadId: row.thread_id ? String(row.thread_id) : null,
    memoryMode: (row.memory_mode || 'enabled') as Agent['memoryMode'],
    memoryRetentionDays: row.memory_retention_days === null || row.memory_retention_days === undefined ? null : Number(row.memory_retention_days),
    grants: { ...DEFAULT_GRANTS, ...storedGrants }, createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  }
}

function mapMessage(row: SqlRow): Message {
  return { id: String(row.id), agentId: String(row.agent_id), runId: row.run_id ? String(row.run_id) : null, role: row.role as Message['role'], kind: row.kind as Message['kind'], content: String(row.content), createdAt: String(row.created_at) }
}

function mapRun(row: SqlRow): Run {
  return { id: String(row.id), agentId: String(row.agent_id), threadId: row.thread_id ? String(row.thread_id) : null, turnId: row.turn_id ? String(row.turn_id) : null, status: row.status as RunStatus, input: String(row.input), output: row.output ? String(row.output) : null, error: row.error ? String(row.error) : null, startedAt: String(row.started_at), completedAt: row.completed_at ? String(row.completed_at) : null }
}

function mapHandoff(row: SqlRow): Handoff {
  return {
    id: String(row.id), parentRunId: String(row.parent_run_id), fromAgentId: String(row.from_agent_id), toAgentId: String(row.to_agent_id),
    status: row.status as HandoffStatus, prompt: String(row.prompt), result: row.result ? String(row.result) : null,
    error: row.error ? String(row.error) : null, createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null
  }
}

function mapApproval(row: SqlRow): Approval {
  const request = parseJson<Record<string, unknown>>(row.request_json, {})
  return { id: String(row.id), agentId: row.agent_id ? String(row.agent_id) : null, runId: row.run_id ? String(row.run_id) : null, requestId: String(row.request_id), method: String(row.method), title: String(row.title), summary: String(row.summary), impact: approvalImpact(String(row.method), request), request, status: row.status as ApprovalStatus, decision: row.decision ? String(row.decision) : null, createdAt: String(row.created_at), resolvedAt: row.resolved_at ? String(row.resolved_at) : null }
}

function approvalImpact(method: string, request: Record<string, unknown>): Approval['impact'] {
  if (method === 'local.shortcut.run') return { targetResource: `Shortcut “${String(request.name ?? '')}”`, dataLeavingMac: 'Only the exact displayed Shortcut input, if the Shortcut itself uses network actions.', reversibility: 'Depends on the Shortcut; SplittBot cannot undo it.', afterApproval: 'Runs the named local Shortcut once and saves its text result as an artifact.', editableFields: ['input'] }
  if (method === 'local.gui.session') return { targetResource: String(request.targetApp ?? 'Local Mac app'), dataLeavingMac: 'No data is sent by SplittBot unless an approved step types it into a networked app.', reversibility: 'GUI effects may not be reversible; use Take Over or Emergency Stop to halt remaining steps.', afterApproval: `Runs ${Array.isArray(request.steps) ? request.steps.length : 0} bound GUI steps in the serialized control lane.`, editableFields: [] }
  if (method.includes('commandExecution')) return { targetResource: String(request.cwd ?? 'Local command environment'), dataLeavingMac: 'Command-defined; review the exact command and network grant.', reversibility: 'Commands may change files or external systems and may not be reversible.', afterApproval: 'Returns one approval decision to the active Codex turn.', editableFields: [] }
  if (method.includes('fileChange')) return { targetResource: String(request.cwd ?? 'Approved local workspace'), dataLeavingMac: 'None through the file edit itself.', reversibility: 'Local edits can usually be reviewed or reverted, but are not automatically rolled back.', afterApproval: 'Allows the displayed file change within the current turn.', editableFields: [] }
  if (method === 'mcpServer/elicitation/request') return { targetResource: String(request.serverName ?? 'Connector'), dataLeavingMac: String(request.message ?? 'The connector receives the approved response.'), reversibility: 'Connector-side effects depend on the request.', afterApproval: 'Returns the decision to the requesting connector.', editableFields: [] }
  return { targetResource: 'Current Codex turn', dataLeavingMac: 'Only the displayed response or temporary permission.', reversibility: 'No action occurs until the active turn receives the response.', afterApproval: 'Returns the decision to the pending Codex request.', editableFields: [] }
}

function mapWorkspace(row: SqlRow): Workspace {
  return { id: String(row.id), name: String(row.name), objective: String(row.objective), status: row.status as Workspace['status'], currentOwnerAgentId: String(row.current_owner_agent_id), memberIds: parseJson(row.member_ids_json, []), autoCoordinate: Boolean(row.auto_coordinate), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

function mapWorkspaceEvent(row: SqlRow): WorkspaceEvent {
  return { id: String(row.id), workspaceId: String(row.workspace_id), runId: row.run_id ? String(row.run_id) : null, agentId: row.agent_id ? String(row.agent_id) : null, type: row.type as WorkspaceEvent['type'], summary: String(row.summary), detail: parseJson(row.detail_json, {}), createdAt: String(row.created_at) }
}

function mapAgentMemory(row: SqlRow): AgentMemory {
  return { id: String(row.id), agentId: String(row.agent_id), content: String(row.content), source: row.source as AgentMemory['source'], createdAt: String(row.created_at) }
}

function mapAcceptanceCheck(row: SqlRow): AcceptanceCheck {
  return { key: row.key as AcceptanceCheck['key'], label: String(row.label), status: row.status as AcceptanceCheck['status'], detail: String(row.detail), evidence: row.evidence ? String(row.evidence) : null, checkedAt: row.checked_at ? String(row.checked_at) : null }
}

function mapArtifact(row: SqlRow): Artifact {
  return { id: String(row.id), agentId: String(row.agent_id), runId: row.run_id ? String(row.run_id) : null, name: String(row.name), kind: row.kind as Artifact['kind'], content: String(row.content), path: row.path ? String(row.path) : null, createdAt: String(row.created_at) }
}

function mapAudit(row: SqlRow): AuditEvent {
  return { id: String(row.id), type: String(row.type), actor: row.actor as AuditEvent['actor'], agentId: row.agent_id ? String(row.agent_id) : null, runId: row.run_id ? String(row.run_id) : null, summary: String(row.summary), detail: parseJson(row.detail_json, {}), createdAt: String(row.created_at) }
}

function mapRoutine(row: SqlRow): Routine {
  return {
    id: String(row.id), agentId: String(row.agent_id), title: String(row.title), prompt: String(row.prompt),
    schedule: parseJson(row.schedule_json, { kind: 'interval', intervalMinutes: 60 }), status: row.status as RoutineStatus,
    catchUpPolicy: row.catch_up_policy as Routine['catchUpPolicy'], maxRetries: Number(row.max_retries),
    retryDelayMinutes: Number(row.retry_delay_minutes), notifyPolicy: row.notify_policy as Routine['notifyPolicy'],
    skillPath: row.skill_path ? String(row.skill_path) : null, nextRunAt: String(row.next_run_at),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  }
}

function mapRoutineAttempt(row: SqlRow): RoutineAttempt {
  return {
    id: String(row.id), routineId: String(row.routine_id), runId: row.run_id ? String(row.run_id) : null,
    attemptNo: Number(row.attempt_no), status: row.status as RoutineAttemptStatus, scheduledFor: String(row.scheduled_for),
    retryAt: row.retry_at ? String(row.retry_at) : null, startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null, error: row.error ? String(row.error) : null
  }
}

function mapNotification(row: SqlRow): NotificationRecord {
  return {
    id: String(row.id), type: row.type as NotificationRecord['type'], title: String(row.title), body: String(row.body),
    agentId: row.agent_id ? String(row.agent_id) : null, runId: row.run_id ? String(row.run_id) : null,
    read: Boolean(row.is_read), createdAt: String(row.created_at)
  }
}

function mapGuiSession(row: SqlRow): GuiSession {
  return {
    id: String(row.id), agentId: String(row.agent_id), approvalId: row.approval_id ? String(row.approval_id) : null,
    targetApp: String(row.target_app), objective: String(row.objective), steps: parseJson(row.steps_json, []), maxRetries: Number(row.max_retries), planHash: String(row.plan_hash),
    status: row.status as GuiSessionStatus, currentStep: Number(row.current_step), totalSteps: Number(row.total_steps),
    pauseReason: row.pause_reason ? String(row.pause_reason) : null, error: row.error ? String(row.error) : null,
    createdAt: String(row.created_at), startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null
  }
}

function mapGuiEvidence(row: SqlRow): GuiEvidence {
  return {
    id: String(row.id), sessionId: String(row.session_id), kind: row.kind as GuiEvidenceKind,
    stepIndex: row.step_index === null || row.step_index === undefined ? null : Number(row.step_index),
    summary: String(row.summary), path: String(row.path), createdAt: String(row.created_at)
  }
}
