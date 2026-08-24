import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import {
  Archive,
  Bot,
  Boxes,
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Gauge,
  Hand,
  History,
  Inbox,
  LoaderCircle,
  LogIn,
  LogOut,
  MessageSquareText,
  Monitor,
  MoreHorizontal,
  Pencil,
  Pause,
  Play,
  Plug,
  Plus,
  Save,
  ScreenShare,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  TriangleAlert,
  Upload,
  Users,
  Workflow,
  X
} from 'lucide-react'
import type { Agent, AgentAvatar, AgentInput, AppEvent, AppSnapshot, ConnectorInput, GuiEvidence, GuiSessionInput, GuiStep, Message, RoutineInput, Run } from '../../shared/contracts'

type Section = 'home' | 'agents' | 'runs' | 'routines' | 'integrations' | 'computer' | 'approvals' | 'notifications' | 'artifacts' | 'audit' | 'settings'

const COLORS = ['#7657d8', '#d1654b', '#16876f', '#3f71c7', '#a56827', '#9a4d82']
const AVATAR_EMOJIS = ['🤖', '🦊', '🐼', '🧭', '🔬', '🎨', '🛠️', '🧠']

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('home')
  const [composer, setComposer] = useState('')
  const [streaming, setStreaming] = useState<Record<string, string>>({})
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agentEditor, setAgentEditor] = useState<Agent | 'new' | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async (agentId?: string | null) => {
    try {
      const next = await window.splittbot.bootstrap(agentId ?? undefined)
      setSnapshot(next)
      if (!selectedAgentId && next.agents[0]) setSelectedAgentId(next.agents[0].id)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }, [selectedAgentId])

  useEffect(() => {
    void refresh(selectedAgentId)
  }, [selectedAgentId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => window.splittbot.events.subscribe((event: AppEvent) => {
    if (event.type === 'run:delta') {
      setStreaming((current) => ({ ...current, [event.runId]: `${current[event.runId] ?? ''}${event.delta}` }))
      return
    }
    if (event.type === 'runtime:warning') {
      setWarning(event.message)
      return
    }
    if (event.type === 'run:completed') {
      setStreaming((current) => {
        const next = { ...current }
        delete next[event.runId]
        return next
      })
    }
    void refresh(selectedAgentId)
  }), [refresh, selectedAgentId])

  const selectedAgent = snapshot?.agents.find((agent) => agent.id === selectedAgentId) ?? null
  const selectedMessages = snapshot?.messages.filter((message) => message.agentId === selectedAgentId) ?? []
  const selectedRuns = snapshot?.runs.filter((run) => run.agentId === selectedAgentId) ?? []
  const activeRun = selectedRuns.find((run) => ['queued', 'running', 'waitingApproval'].includes(run.status)) ?? null
  const pendingApprovals = snapshot?.approvals.filter((approval) => approval.status === 'pending') ?? []
  const unreadNotifications = snapshot?.notifications.filter((notification) => !notification.read) ?? []

  async function runAction(action: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh(selectedAgentId)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(): Promise<void> {
    if (!selectedAgent || !composer.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await window.splittbot.chat.send(selectedAgent.id, composer)
      setComposer('')
      await refresh(selectedAgent.id)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  async function startLogin(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const login = await window.splittbot.auth.signIn()
      await window.splittbot.app.openExternal(login.authUrl)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  if (!snapshot) {
    return <div className="splash"><div className="brand-mark"><Sparkles size={24} /></div><LoaderCircle className="spin" /> Starting your agent desk…</div>
  }

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="drag-region" />
        <div className="logo" title="SplittBot"><Sparkles size={19} strokeWidth={2.4} /></div>
        <nav className="rail-nav" aria-label="Primary navigation">
          <RailButton active={section === 'home'} label="Home" icon={<Gauge />} onClick={() => setSection('home')} />
          <RailButton active={section === 'agents'} label="Agents" icon={<Bot />} onClick={() => setSection('agents')} />
          <RailButton active={section === 'runs'} label="Runs" icon={<Play />} onClick={() => setSection('runs')} />
          <RailButton active={section === 'routines'} label="Routines" icon={<CalendarClock />} onClick={() => setSection('routines')} />
          <RailButton active={section === 'integrations'} label="Tools" icon={<Plug />} onClick={() => setSection('integrations')} />
          <RailButton active={section === 'computer'} label="Computer" icon={<Monitor />} onClick={() => setSection('computer')} />
          <RailButton active={section === 'approvals'} label="Approvals" icon={<Inbox />} count={pendingApprovals.length} onClick={() => setSection('approvals')} />
          <RailButton active={section === 'notifications'} label="Notifications" icon={<Bell />} count={unreadNotifications.length} onClick={() => setSection('notifications')} />
          <RailButton active={section === 'artifacts'} label="Artifacts" icon={<Boxes />} onClick={() => setSection('artifacts')} />
          <RailButton active={section === 'audit'} label="Audit" icon={<History />} onClick={() => setSection('audit')} />
        </nav>
        <div className="rail-spacer" />
        <RailButton active={section === 'settings'} label="Settings" icon={<Settings />} onClick={() => setSection('settings')} />
        <AccountDot state={snapshot.account.state} />
      </aside>

      <aside className="team-pane">
        <div className="team-header">
          <div>
            <span className="eyebrow">Your workspace</span>
            <h1>Agent team</h1>
          </div>
          <button className="icon-button" aria-label="New agent" title="New agent" onClick={() => setAgentEditor('new')}><Plus size={18} /></button>
        </div>
        <div className="attention-card" onClick={() => setSection('approvals')} role="button" tabIndex={0}>
          <div className="attention-icon"><ShieldCheck size={17} /></div>
          <div><strong>{pendingApprovals.length ? `${pendingApprovals.length} need review` : 'All clear'}</strong><span>{pendingApprovals.length ? 'Agents are waiting for you' : 'No approvals are waiting'}</span></div>
          <ChevronRight size={16} />
        </div>
        <div className="pane-label"><span>Agents</span><span>{snapshot.agents.length}</span></div>
        <div className="agent-list">
          {snapshot.agents.map((agent) => {
            const run = snapshot.runs.find((item) => item.agentId === agent.id && ['queued', 'running', 'waitingApproval'].includes(item.status))
            return (
              <button key={agent.id} className={`agent-row ${selectedAgentId === agent.id ? 'selected' : ''}`} onClick={() => { setSelectedAgentId(agent.id); setSection('agents') }}>
                <Avatar agent={agent} />
                <span className="agent-copy"><strong>{agent.name}</strong><small>{run ? statusText(run.status) : agent.role}</small></span>
                {run ? <span className={`status-orb ${run.status}`} /> : null}
              </button>
            )
          })}
        </div>
        <div className="team-footer">
          <span className={`runtime-dot ${snapshot.account.state}`} />
          <div><strong>{snapshot.account.state === 'authenticated' ? 'Codex connected' : 'Codex needs attention'}</strong><small>{snapshot.account.planType || snapshot.account.runtimeSource || 'Local runtime'}</small></div>
        </div>
      </aside>

      <main className="main-pane">
        {error ? <Banner tone="error" text={error} onClose={() => setError(null)} /> : null}
        {warning ? <Banner tone="warning" text={warning} onClose={() => setWarning(null)} /> : null}
        {snapshot.account.state === 'signedOut' ? <SignInBanner onSignIn={() => void startLogin()} /> : null}
        {section === 'home' ? <Home snapshot={snapshot} onOpen={(next) => setSection(next)} /> : null}
        {section === 'agents' && selectedAgent ? (
          <AgentConversation
            agent={selectedAgent}
            agents={snapshot.agents}
            messages={selectedMessages}
            runs={selectedRuns}
            streaming={streaming}
            composer={composer}
            setComposer={setComposer}
            onSend={() => void sendMessage()}
            onEdit={() => setAgentEditor(selectedAgent)}
            onCancel={activeRun ? () => void window.splittbot.chat.cancel(activeRun.id) : undefined}
            onSaveArtifact={(message) => void window.splittbot.artifacts.create({ agentId: selectedAgent.id, runId: message.runId, name: `${selectedAgent.name} response`, content: message.content })}
            busy={busy}
          />
        ) : null}
        {section === 'runs' ? <RunsView runs={snapshot.runs} agents={snapshot.agents} /> : null}
        {section === 'routines' ? <RoutinesView snapshot={snapshot} busy={busy} onAction={runAction} /> : null}
        {section === 'integrations' ? <IntegrationsView snapshot={snapshot} busy={busy} onAction={runAction} /> : null}
        {section === 'computer' ? <GuiControlView snapshot={snapshot} busy={busy} onAction={runAction} onOpenApprovals={() => setSection('approvals')} /> : null}
        {section === 'approvals' ? <ApprovalsView snapshot={snapshot} onResolve={async (id, decision) => { await window.splittbot.approvals.resolve(id, decision); await refresh(selectedAgentId) }} /> : null}
        {section === 'notifications' ? <NotificationsView snapshot={snapshot} onAction={runAction} /> : null}
        {section === 'artifacts' ? <ArtifactsView snapshot={snapshot} /> : null}
        {section === 'audit' ? <AuditView snapshot={snapshot} /> : null}
        {section === 'settings' ? <SettingsView snapshot={snapshot} onSignIn={() => void startLogin()} onSignOut={async () => { await window.splittbot.auth.signOut(); await refresh(selectedAgentId) }} onRefresh={() => void refresh(selectedAgentId)} /> : null}
      </main>

      {agentEditor ? <AgentEditor value={agentEditor} agents={snapshot.agents} models={snapshot.models} connectors={snapshot.connectors} skills={snapshot.skills} shortcuts={snapshot.shortcuts} fallbackCwd={selectedAgent?.cwd || '/Users'} onClose={() => setAgentEditor(null)} onSave={async (input) => {
        try {
          const saved = agentEditor === 'new' ? await window.splittbot.agents.create(input) : await window.splittbot.agents.update(agentEditor.id, input)
          setAgentEditor(null)
          setSelectedAgentId(saved.id)
          setSection('agents')
          await refresh(saved.id)
        } catch (caught) { setError(messageOf(caught)) }
      }} onArchive={agentEditor === 'new' ? undefined : async () => {
        if (!window.confirm(`Archive ${agentEditor.name}? Its local history will remain in the audit record.`)) return
        try {
          await window.splittbot.agents.archive(agentEditor.id)
          setAgentEditor(null)
          const next = await window.splittbot.bootstrap()
          setSnapshot(next)
          setSelectedAgentId(next.agents[0]?.id ?? null)
        } catch (caught) { setError(messageOf(caught)) }
      }} /> : null}
    </div>
  )
}

function RailButton({ active, label, icon, count, onClick }: { active: boolean; label: string; icon: JSX.Element; count?: number; onClick: () => void }): JSX.Element {
  return <button className={`rail-button ${active ? 'active' : ''}`} aria-label={label} title={label} onClick={onClick}>{icon}{count ? <span className="rail-count">{count}</span> : null}</button>
}

function AccountDot({ state }: { state: AppSnapshot['account']['state'] }): JSX.Element {
  return <div className={`account-dot ${state}`} title={`Codex: ${state}`}><Bot size={16} /></div>
}

function Avatar({ agent, size = 'normal' }: { agent: Pick<Agent, 'name' | 'color' | 'avatar'>; size?: 'normal' | 'large' }): JSX.Element {
  const content = agent.avatar.type === 'image' && agent.avatar.value
    ? <img src={agent.avatar.value} alt={`${agent.name} avatar`} />
    : agent.avatar.type === 'emoji' && agent.avatar.value
      ? <span className="avatar-emoji">{agent.avatar.value}</span>
      : agent.name.slice(0, 2).toUpperCase()
  return <span className={`avatar ${size} ${agent.avatar.type}`} style={{ background: agent.color }}>{content}</span>
}

function Banner({ tone, text, onClose }: { tone: 'error' | 'warning'; text: string; onClose: () => void }): JSX.Element {
  return <div className={`banner ${tone}`}><CircleAlert size={17} /><span>{text}</span><button aria-label="Dismiss" onClick={onClose}><X size={15} /></button></div>
}

function SignInBanner({ onSignIn }: { onSignIn: () => void }): JSX.Element {
  return <div className="sign-in-banner"><div><LogIn size={18} /><span><strong>Connect your ChatGPT account</strong> to start Codex agents. No API key is used.</span></div><button className="secondary-button" onClick={onSignIn}>Sign in</button></div>
}

function Home({ snapshot, onOpen }: { snapshot: AppSnapshot; onOpen: (section: Section) => void }): JSX.Element {
  const active = snapshot.runs.filter((run) => ['queued', 'running', 'waitingApproval'].includes(run.status))
  const complete = snapshot.runs.filter((run) => run.status === 'completed').slice(0, 4)
  const pending = snapshot.approvals.filter((approval) => approval.status === 'pending')
  return <div className="page scroll-page">
    <header className="page-title"><div><span className="eyebrow">Command center</span><h2>Good to see you.</h2><p>Your local agent team is ready for focused work.</p></div><div className="account-chip"><span className={`runtime-dot ${snapshot.account.state}`} />{snapshot.account.email || 'ChatGPT account'}<small>{snapshot.account.planType || snapshot.account.state}</small></div></header>
    <section className="metric-grid">
      <Metric icon={<Bot />} label="Active agents" value={String(snapshot.agents.length)} accent="violet" />
      <Metric icon={<LoaderCircle />} label="Working now" value={String(active.length)} accent="blue" />
      <Metric icon={<ShieldCheck />} label="Need approval" value={String(pending.length)} accent="amber" />
      <Metric icon={<FileText />} label="Artifacts" value={String(snapshot.artifacts.length)} accent="green" />
    </section>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Live desk</span><h3>Agents</h3></div><button className="text-button" onClick={() => onOpen('agents')}>Open team <ChevronRight size={14} /></button></div>
        <div className="home-agent-grid">{snapshot.agents.map((agent) => <div className="home-agent" key={agent.id}><Avatar agent={agent} /><div><strong>{agent.name}</strong><span>{agent.role}</span></div><span className="ready-pill">Ready</span></div>)}</div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Recent results</span><h3>Completed work</h3></div><button className="text-button" onClick={() => onOpen('runs')}>All runs <ChevronRight size={14} /></button></div>
        {complete.length ? <div className="result-list">{complete.map((run) => <RunCompact key={run.id} run={run} agent={snapshot.agents.find((agent) => agent.id === run.agentId)} />)}</div> : <Empty icon={<Clock3 />} title="No completed runs yet" detail="Give an agent its first task to see results here." />}
      </section>
    </div>
  </div>
}

function Metric({ icon, label, value, accent }: { icon: JSX.Element; label: string; value: string; accent: string }): JSX.Element {
  return <div className={`metric ${accent}`}><span className="metric-icon">{icon}</span><div><strong>{value}</strong><span>{label}</span></div></div>
}

function AgentConversation(props: {
  agent: Agent; agents: Agent[]; messages: Message[]; runs: Run[]; streaming: Record<string, string>; composer: string; setComposer: (value: string) => void; onSend: () => void; onEdit: () => void; onCancel?: () => void; onSaveArtifact: (message: Message) => void; busy: boolean
}): JSX.Element {
  const { agent, agents, messages, runs, streaming, composer, setComposer, onSend, onEdit, onCancel, onSaveArtifact, busy } = props
  const streamEntries = Object.entries(streaming).filter(([runId]) => runs.some((run) => run.id === runId))
  return <div className="conversation">
    <header className="conversation-header">
      <div className="agent-heading"><Avatar agent={agent} size="large" /><div><span className="eyebrow">Direct agent</span><h2>{agent.name}</h2><p>{agent.role}</p></div></div>
      <div className="header-actions"><span className="safety-pill"><ShieldCheck size={14} /> {agent.accessMode === 'readOnly' ? 'Read only' : 'Workspace write'}</span><button className="icon-button" aria-label="Edit agent" onClick={onEdit}><Pencil size={17} /></button><button className="icon-button" aria-label="More options"><MoreHorizontal size={18} /></button></div>
    </header>
    <div className="conversation-body">
      <div className="message-scroll" data-testid="message-list">
        {!messages.length ? <EmptyConversation agent={agent} /> : null}
        {messages.map((message) => <MessageBubble key={message.id} message={message} agent={agent} onSave={() => onSaveArtifact(message)} />)}
        {streamEntries.map(([runId, text]) => <div className="message-row agent-message" key={runId}><Avatar agent={agent} /><div className="message-stack"><div className="message-meta"><strong>{agent.name}</strong><span>Working now</span></div><div className="message-card streaming-card">{text || <span className="thinking"><i /><i /><i /></span>}</div></div></div>)}
      </div>
      <AgentInspector agent={agent} agents={agents} runs={runs} />
    </div>
    <div className="composer-wrap">
      <div className="composer-box">
        <MentionTextarea value={composer} onChange={setComposer} agents={agents} currentAgentId={agent.id} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() } }} placeholder={`Message ${agent.name}… Tag @teammates to collaborate.`} ariaLabel={`Message ${agent.name}`} />
        <div className="composer-actions"><div><button className="composer-tool" title="Attach files"><Plus size={17} /></button><span>Enter to send · Shift+Enter for a new line</span></div>{onCancel ? <button className="stop-button" onClick={onCancel}><Square size={13} fill="currentColor" /> Stop</button> : <button className="send-button" aria-label="Send" disabled={!composer.trim() || busy} onClick={onSend}>{busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}</button>}</div>
      </div>
      <p className="composer-note">Tag @AgentName or @all to collaborate. Every agent keeps their own model, effort, workspace, and permissions.</p>
    </div>
  </div>
}

function EmptyConversation({ agent }: { agent: Agent }): JSX.Element {
  return <div className="empty-conversation"><Avatar agent={agent} size="large" /><span className="eyebrow">New conversation</span><h3>What should {agent.name} own?</h3><p>{agent.instructions}</p><div className="starter-grid"><span>Prepare a brief from this workspace</span><span>Review a draft without changing it</span><span>Plan the next three actions</span></div></div>
}

function MessageBubble({ message, agent, onSave }: { message: Message; agent: Agent; onSave: () => void }): JSX.Element {
  const isUser = message.role === 'user'
  const isStatus = message.kind === 'status'
  return <div className={`message-row ${isUser ? 'user-message' : 'agent-message'} ${message.kind === 'error' ? 'error-message' : ''} ${isStatus ? 'status-message' : ''}`}>
    {isUser ? <span className="user-avatar">ME</span> : isStatus ? <span className="collaboration-avatar"><Users size={16} /></span> : <Avatar agent={agent} />}
    <div className="message-stack"><div className="message-meta"><strong>{isUser ? 'You' : isStatus ? 'Team handoff' : agent.name}</strong><span>{formatTime(message.createdAt)}</span></div><div className="message-card">{message.content}</div>{!isUser && !isStatus && message.kind !== 'error' ? <button className="save-response" onClick={onSave}><Save size={13} /> Save as artifact</button> : null}</div>
  </div>
}

function AgentInspector({ agent, agents, runs }: { agent: Agent; agents: Agent[]; runs: Run[] }): JSX.Element {
  const lastRun = runs[0]
  const collaborators = agents.filter((candidate) => agent.collaboratorIds.includes(candidate.id))
  return <aside className="inspector">
    <div className="inspector-section"><span className="eyebrow">Current state</span><div className="state-line"><span className={`status-orb ${lastRun?.status || 'ready'}`} /><strong>{lastRun && ['running', 'queued', 'waitingApproval'].includes(lastRun.status) ? statusText(lastRun.status) : 'Ready for a task'}</strong></div></div>
    <div className="inspector-section"><span className="eyebrow">Runtime</span><InspectorLine label="Model" value={agent.model || 'Plan default'} /><InspectorLine label="AI effort" value={agent.reasoningEffort || 'Model default'} /><InspectorLine label="Access" value={agent.accessMode === 'readOnly' ? 'Read only' : 'Workspace write'} /><InspectorLine label="Thread" value={agent.threadId ? `…${agent.threadId.slice(-8)}` : 'Starts on first task'} /></div>
    <div className="inspector-section"><span className="eyebrow">Collaborators</span><div className="collaborator-list">{collaborators.length ? collaborators.map((candidate) => <span key={candidate.id}>@{candidate.name}</span>) : <p>Tag any teammate in instructions or chat.</p>}</div></div>
    <div className="inspector-section"><span className="eyebrow">Workspace</span><p className="path-value" title={agent.cwd}>{agent.cwd}</p></div>
    <div className="inspector-section"><span className="eyebrow">Grants</span><div className="grant-list"><span><FileText size={14} /> {agent.grants.readableRoots.length} readable root{agent.grants.readableRoots.length === 1 ? '' : 's'}</span><span><Boxes size={14} /> {agent.grants.allowedApps.length} approved app{agent.grants.allowedApps.length === 1 ? '' : 's'}</span><span><Plug size={14} /> {agent.grants.allowedConnectors.length} connector{agent.grants.allowedConnectors.length === 1 ? '' : 's'}</span><span><Workflow size={14} /> {agent.grants.allowedSkillPaths.length} skill{agent.grants.allowedSkillPaths.length === 1 ? '' : 's'}</span><span><ShieldCheck size={14} /> Network {agent.grants.networkAccess ? 'allowed' : 'blocked'}</span></div></div>
  </aside>
}

function InspectorLine({ label, value }: { label: string; value: string }): JSX.Element { return <div className="inspector-line"><span>{label}</span><strong>{value}</strong></div> }

function RunsView({ runs, agents }: { runs: Run[]; agents: Agent[] }): JSX.Element {
  return <Page title="Runs" eyebrow="Execution history" detail="Every attempt, state change, and result stays inspectable."><div className="table-panel"><div className="data-table table-head"><span>Agent</span><span>Task</span><span>Status</span><span>Started</span></div>{runs.length ? runs.map((run) => <div className="data-table" key={run.id}><span className="table-agent"><span className={`status-orb ${run.status}`} />{agents.find((agent) => agent.id === run.agentId)?.name || 'Agent'}</span><span className="truncate">{run.input}</span><span><StatusPill status={run.status} /></span><span>{formatTime(run.startedAt)}</span></div>) : <Empty icon={<Play />} title="No runs yet" detail="Agent work will appear here." />}</div></Page>
}

function RoutinesView({ snapshot, busy, onAction }: { snapshot: AppSnapshot; busy: boolean; onAction: (action: () => Promise<unknown>) => Promise<void> }): JSX.Element {
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [agentId, setAgentId] = useState(snapshot.agents[0]?.id ?? '')
  const [title, setTitle] = useState('Morning brief')
  const [prompt, setPrompt] = useState('Review the approved sources and prepare a concise brief with decisions, risks, and next actions. Do not send or change anything.')
  const [scheduleKind, setScheduleKind] = useState<'interval' | 'daily'>('daily')
  const [intervalMinutes, setIntervalMinutes] = useState(60)
  const [timeOfDay, setTimeOfDay] = useState('08:00')
  const [daysOfWeek, setDaysOfWeek] = useState([0, 1, 2, 3, 4, 5, 6])
  const [catchUpPolicy, setCatchUpPolicy] = useState<RoutineInput['catchUpPolicy']>('runOnce')
  const [notifyPolicy, setNotifyPolicy] = useState<RoutineInput['notifyPolicy']>('always')
  const [maxRetries, setMaxRetries] = useState(1)
  const [skillPath, setSkillPath] = useState('')
  const agent = snapshot.agents.find((item) => item.id === agentId)
  const eligibleSkills = snapshot.skills.filter((skill) => skill.reviewStatus === 'reviewed' && agent?.grants.allowedSkillPaths.includes(skill.path))

  async function create(): Promise<void> {
    const input: RoutineInput = {
      agentId, title, prompt,
      schedule: scheduleKind === 'interval' ? { kind: 'interval', intervalMinutes } : { kind: 'daily', timeOfDay, daysOfWeek },
      catchUpPolicy, maxRetries, retryDelayMinutes: 5, notifyPolicy, skillPath: skillPath || null
    }
    await onAction(() => editingId ? window.splittbot.routines.update(editingId, input) : window.splittbot.routines.create(input))
    setShowCreate(false)
    setEditingId(null)
  }

  function edit(routine: AppSnapshot['routines'][number]): void {
    setEditingId(routine.id)
    setAgentId(routine.agentId)
    setTitle(routine.title)
    setPrompt(routine.prompt)
    setScheduleKind(routine.schedule.kind)
    if (routine.schedule.kind === 'interval') setIntervalMinutes(routine.schedule.intervalMinutes)
    else { setTimeOfDay(routine.schedule.timeOfDay); setDaysOfWeek(routine.schedule.daysOfWeek) }
    setCatchUpPolicy(routine.catchUpPolicy)
    setNotifyPolicy(routine.notifyPolicy)
    setMaxRetries(routine.maxRetries)
    setSkillPath(routine.skillPath ?? '')
    setShowCreate(true)
  }

  return <Page title="Routines" eyebrow="Awake-only scheduling" detail="SplittBot runs these while your Mac is awake and the app is open, with explicit catch-up and retry rules.">
    <div className="page-actions"><button className="primary-button" onClick={() => { setEditingId(null); setShowCreate((value) => !value) }}><Plus size={15} /> New routine</button></div>
    {showCreate ? <section className="inline-form panel">
      <div className="form-grid compact-form">
        <label><span>Agent</span><select value={agentId} onChange={(event) => { setAgentId(event.target.value); setSkillPath('') }}>{snapshot.agents.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.role}</option>)}</select></label>
        <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="wide"><span>Instructions</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
        <label><span>Schedule</span><select value={scheduleKind} onChange={(event) => setScheduleKind(event.target.value as 'interval' | 'daily')}><option value="daily">Daily</option><option value="interval">Every interval</option></select></label>
        {scheduleKind === 'daily' ? <label><span>Local time</span><input type="time" value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)} /></label> : <label><span>Minutes</span><input type="number" min="1" value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} /></label>}
        {scheduleKind === 'daily' ? <div className="wide teammate-field"><span className="field-title">Days</span><div className="teammate-tags">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <button type="button" key={day} className={daysOfWeek.includes(index) ? 'selected' : ''} onClick={() => setDaysOfWeek((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort())}>{day}</button>)}</div></div> : null}
        <label><span>Missed while asleep</span><select value={catchUpPolicy} onChange={(event) => setCatchUpPolicy(event.target.value as RoutineInput['catchUpPolicy'])}><option value="runOnce">Run once on wake</option><option value="skip">Skip and record</option></select></label>
        <label><span>Notifications</span><select value={notifyPolicy} onChange={(event) => setNotifyPolicy(event.target.value as RoutineInput['notifyPolicy'])}><option value="always">Every completion</option><option value="failure">Failures only</option><option value="never">Never</option></select></label>
        <label><span>Retries</span><select value={maxRetries} onChange={(event) => setMaxRetries(Number(event.target.value))}><option value="0">None</option><option value="1">1 retry</option><option value="2">2 retries</option><option value="3">3 retries</option></select></label>
        <label><span>Reviewed skill</span><select value={skillPath} onChange={(event) => setSkillPath(event.target.value)}><option value="">No explicit skill</option>{eligibleSkills.map((skill) => <option key={skill.path} value={skill.path}>{skill.displayName} · ${skill.name}</option>)}</select></label>
      </div>
      <div className="inline-form-actions"><button className="secondary-button" onClick={() => { setShowCreate(false); setEditingId(null) }}>Cancel</button><button className="primary-button" disabled={busy || !agentId || !title.trim() || !prompt.trim() || (scheduleKind === 'daily' && !daysOfWeek.length)} onClick={() => void create()}><CalendarClock size={15} /> {editingId ? 'Save routine' : 'Create routine'}</button></div>
    </section> : null}
    <div className="routine-grid">{snapshot.routines.length ? snapshot.routines.map((routine) => {
      const lastAttempt = snapshot.routineAttempts.find((attempt) => attempt.routineId === routine.id)
      return <article className="routine-card" key={routine.id}><div className="routine-top"><span className={`integration-icon ${routine.status}`}><CalendarClock size={18} /></span><div><h3>{routine.title}</h3><span>{snapshot.agents.find((item) => item.id === routine.agentId)?.name || 'Agent'}</span></div><StatusPill status={routine.status} /></div><p>{routine.prompt}</p><div className="routine-meta"><span>Next: {formatTime(routine.nextRunAt)}</span><span>{routine.catchUpPolicy === 'runOnce' ? 'Catch up once' : 'Skip missed'}</span><span>{routine.maxRetries} retries</span>{lastAttempt ? <span>Last: {statusText(lastAttempt.status)}</span> : null}</div><div className="button-row"><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.routines.runNow(routine.id))}><Play size={14} /> Run now</button><button className="ghost-button" disabled={busy} onClick={() => edit(routine)}><Pencil size={14} /> Edit</button><button className="ghost-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.routines.setStatus(routine.id, routine.status === 'active' ? 'paused' : 'active'))}>{routine.status === 'active' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button></div></article>
    }) : <Empty icon={<CalendarClock />} title="No routines yet" detail="Create an awake-only schedule for an agent." />}</div>
  </Page>
}

function IntegrationsView({ snapshot, busy, onAction }: { snapshot: AppSnapshot; busy: boolean; onAction: (action: () => Promise<unknown>) => Promise<void> }): JSX.Element {
  const [tab, setTab] = useState<'connectors' | 'skills' | 'shortcuts'>('connectors')
  const [showAdd, setShowAdd] = useState(false)
  const [connectorName, setConnectorName] = useState('')
  const [transport, setTransport] = useState<'streamableHttp' | 'stdio'>('streamableHttp')
  const [endpoint, setEndpoint] = useState('')
  const [connectorArgs, setConnectorArgs] = useState('')
  const [shortcutAgentId, setShortcutAgentId] = useState(snapshot.agents[0]?.id ?? '')
  const [shortcutName, setShortcutName] = useState(snapshot.shortcuts[0]?.name ?? '')
  const [shortcutInput, setShortcutInput] = useState('Prepare a local draft. Do not send or publish it.')

  async function addConnector(): Promise<void> {
    const input: ConnectorInput = transport === 'stdio'
      ? { name: connectorName, transport, command: endpoint, args: connectorArgs.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) }
      : { name: connectorName, transport, url: endpoint }
    await onAction(() => window.splittbot.connectors.add(input))
    setShowAdd(false)
  }

  return <Page title="Tools & integrations" eyebrow="Reviewed capabilities" detail="Connect MCP services, review Codex skills, and approve structured Apple Shortcuts without storing API keys.">
    {snapshot.integrationError ? <div className="inline-warning"><CircleAlert size={15} /> {snapshot.integrationError}</div> : null}
    <div className="tab-row"><button className={tab === 'connectors' ? 'active' : ''} onClick={() => setTab('connectors')}>Connectors · {snapshot.connectors.length}</button><button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>Skills · {snapshot.skills.length}</button><button className={tab === 'shortcuts' ? 'active' : ''} onClick={() => setTab('shortcuts')}>Shortcuts · {snapshot.shortcuts.length}</button></div>
    {tab === 'connectors' ? <div><div className="page-actions"><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.connectors.refresh())}>Refresh</button><button className="primary-button" onClick={() => setShowAdd((value) => !value)}><Plus size={14} /> Add connector</button></div>{showAdd ? <section className="inline-form panel"><div className="form-grid compact-form"><label><span>Connector name</span><input value={connectorName} onChange={(event) => setConnectorName(event.target.value)} placeholder="project_docs" /></label><label><span>Transport</span><select value={transport} onChange={(event) => setTransport(event.target.value as 'streamableHttp' | 'stdio')}><option value="streamableHttp">Secure HTTP</option><option value="stdio">Local executable</option></select></label><label className="wide"><span>{transport === 'stdio' ? 'Absolute executable path' : 'HTTPS endpoint'}</span><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={transport === 'stdio' ? '/usr/local/bin/my-mcp-server' : 'https://example.com/mcp'} /></label>{transport === 'stdio' ? <label className="wide"><span>Arguments · one per line</span><textarea value={connectorArgs} onChange={(event) => setConnectorArgs(event.target.value)} placeholder={'--mode\nmcp'} /></label> : null}</div><div className="inline-form-actions"><button className="primary-button" disabled={busy || !connectorName || !endpoint} onClick={() => void addConnector()}>Save connector</button></div></section> : null}<div className="integration-list">{snapshot.connectors.length ? snapshot.connectors.map((connector) => <article className="integration-row" key={connector.name}><span className={`integration-icon ${connector.enabled ? 'active' : 'paused'}`}><Plug size={18} /></span><div><h3>{connector.displayName}</h3><p>{connector.error || `${connector.toolCount} tools · ${connector.resourceCount} resources · ${connector.authStatus}${connector.canGrant ? '' : ' · runtime-managed'}`}</p></div><StatusPill status={connector.enabled ? (connector.error ? 'failed' : 'active') : 'paused'} /><div className="integration-actions">{connector.authStatus === 'notLoggedIn' ? <button className="primary-button" onClick={() => void onAction(async () => { const login = await window.splittbot.connectors.login(connector.name); await window.splittbot.app.openExternal(login.authorizationUrl) })}>Connect OAuth</button> : null}{connector.canGrant ? <button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.connectors.setEnabled(connector.name, !connector.enabled))}>{connector.enabled ? 'Disable' : 'Enable'}</button> : <span className="runtime-managed">Managed by Codex</span>}</div></article>) : <Empty icon={<Plug />} title="No MCP connectors" detail="Add a secure HTTP service or an absolute local server executable." />}</div></div> : null}
    {tab === 'skills' ? <div className="integration-list">{snapshot.skills.length ? snapshot.skills.map((skill) => <article className="integration-row skill-row" key={skill.path}><span className={`integration-icon ${skill.reviewStatus}`}><Workflow size={18} /></span><div><h3>{skill.displayName}</h3><p>{skill.description}</p><small><span className="skill-technical-name">${skill.name}</span> · {skill.scope} · {skill.dependencies.length ? `${skill.dependencies.length} dependencies` : 'No declared tool dependencies'}</small></div><StatusPill status={skill.reviewStatus} /><div className="integration-actions"><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.skills.review(skill.path, skill.reviewStatus === 'reviewed' ? 'unreviewed' : 'reviewed'))}>{skill.reviewStatus === 'reviewed' ? 'Reset review' : 'Approve review'}</button><button className="ghost-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.skills.review(skill.path, 'blocked'))}>Block</button><button className="ghost-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.skills.setEnabled(skill.path, !skill.enabled))}>{skill.enabled ? 'Disable' : 'Enable'}</button></div></article>) : <Empty icon={<Workflow />} title="No skills discovered" detail="Refresh after installing a Codex skill." />}</div> : null}
    {tab === 'shortcuts' ? <div className="shortcut-layout"><section className="panel shortcut-form"><span className="eyebrow">Approval-gated local action</span><h3>Prepare a Shortcut run</h3><p>The exact Shortcut and input are staged in Approvals. Nothing runs until you choose Approve once.</p><label><span>Agent</span><select value={shortcutAgentId} onChange={(event) => setShortcutAgentId(event.target.value)}>{snapshot.agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select></label><label><span>Shortcut</span><select value={shortcutName} onChange={(event) => setShortcutName(event.target.value)}><option value="">Choose…</option>{snapshot.shortcuts.map((shortcut) => <option value={shortcut.name} key={shortcut.name}>{shortcut.name} · {shortcut.grantedAgentCount} agents</option>)}</select></label><label><span>Exact text input</span><textarea value={shortcutInput} onChange={(event) => setShortcutInput(event.target.value)} /></label><button className="primary-button" disabled={busy || !shortcutAgentId || !shortcutName} onClick={() => void onAction(() => window.splittbot.shortcuts.prepare(shortcutAgentId, shortcutName, shortcutInput))}><ShieldCheck size={14} /> Send to approvals</button></section><section className="panel"><h3>Installed Shortcuts</h3><div className="model-tags">{snapshot.shortcuts.map((shortcut) => <span key={shortcut.name}>{shortcut.name}</span>)}</div><p className="muted-copy">Grant individual Shortcuts in each agent profile. SplittBot passes text through a temporary private file and records the result as an artifact.</p></section></div> : null}
  </Page>
}

function GuiControlView({ snapshot, busy, onAction, onOpenApprovals }: { snapshot: AppSnapshot; busy: boolean; onAction: (action: () => Promise<unknown>) => Promise<void>; onOpenApprovals: () => void }): JSX.Element {
  const [agentId, setAgentId] = useState(snapshot.agents[0]?.id ?? '')
  const selectedAgent = snapshot.agents.find((agent) => agent.id === agentId) ?? snapshot.agents[0]
  const approvedApps = selectedAgent?.grants.allowedApps ?? []
  const [targetApp, setTargetApp] = useState(approvedApps[0] ?? '')
  const [objective, setObjective] = useState('Open the approved app and prepare the requested workspace without submitting or saving anything.')
  const [maxRetries, setMaxRetries] = useState(1)
  const [steps, setSteps] = useState<GuiStep[]>([{ type: 'activateApp' }, { type: 'wait', durationMs: 600 }])
  const activeSession = snapshot.gui.sessions.find((session) => session.id === snapshot.gui.laneOwnerSessionId) ?? snapshot.gui.sessions[0] ?? null
  const latestEvidence = activeSession ? snapshot.gui.evidence.find((item) => item.sessionId === activeSession.id) ?? null : null

  useEffect(() => {
    if (!approvedApps.includes(targetApp)) setTargetApp(approvedApps[0] ?? '')
  }, [agentId, approvedApps.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  function changeStep(index: number, type: GuiStep['type']): void {
    const step: GuiStep = type === 'activateApp' ? { type }
      : type === 'wait' ? { type, durationMs: 600 }
        : type === 'clickElement' ? { type, label: 'Open' }
          : type === 'typeText' ? { type, text: 'Draft text only' }
            : { type, key: 'tab' }
    setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? step : item))
  }

  function updateStep(index: number, step: GuiStep): void {
    setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? step : item))
  }

  async function prepare(): Promise<void> {
    const input: GuiSessionInput = { agentId, targetApp, objective, steps, maxRetries }
    await onAction(() => window.splittbot.gui.prepare(input))
  }

  const accessibility = snapshot.gui.permissions.accessibility
  const screenRecording = snapshot.gui.permissions.screenRecording
  return <Page title="Computer control" eyebrow="Phase 3 · visible and interruptible" detail="Run one exact, approval-gated GUI plan at a time. SplittBot pauses on focus changes or modal dialogs and records screenshot evidence.">
    <div className={`emergency-strip ${snapshot.gui.emergencyStopped ? 'latched' : ''}`}>
      <span><TriangleAlert size={18} /><strong>{snapshot.gui.emergencyStopped ? 'Emergency stop is active' : 'Emergency stop'}</strong><small>{snapshot.gui.emergencyStopped ? 'New and queued GUI actions are blocked.' : 'Immediately stop the active lane and cancel queued GUI work.'}</small></span>
      {snapshot.gui.emergencyStopped
        ? <button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.gui.resetEmergencyStop())}>Reset emergency stop</button>
        : <button className="danger-button" disabled={busy} onClick={() => { if (window.confirm('Emergency-stop all GUI control and cancel queued plans?')) void onAction(() => window.splittbot.gui.emergencyStop()) }}><Square size={13} fill="currentColor" /> Emergency stop</button>}
    </div>

    <section className="permission-grid">
      <PermissionCard title="Accessibility" status={accessibility} detail="Required for exact app activation, keyboard actions, and named UI controls." onRequest={() => onAction(() => window.splittbot.gui.requestPermission('accessibility'))} onSettings={() => onAction(() => window.splittbot.gui.openPermissionSettings('accessibility'))} busy={busy} />
      <PermissionCard title="Screen Recording" status={screenRecording} detail="Required for the live view and private before/after verification evidence." onRequest={() => onAction(() => window.splittbot.gui.requestPermission('screenRecording'))} onSettings={() => onAction(() => window.splittbot.gui.openPermissionSettings('screenRecording'))} busy={busy} />
      <div className="permission-card lane-card"><span className="integration-icon active"><ScreenShare size={18} /></span><div><span className="eyebrow">Serialized lane</span><h3>{snapshot.gui.laneOwnerSessionId ? 'In use' : 'Available'}</h3><p>{snapshot.gui.laneOwnerSessionId ? `${activeSession?.targetApp ?? 'An app'} is under controlled automation.` : 'Only one agent can own the keyboard, focus, and screen-control lane.'}</p></div></div>
    </section>

    <div className="gui-layout">
      <section className="panel gui-plan">
        <div className="panel-heading"><div><span className="eyebrow">Prepare</span><h3>Exact GUI plan</h3></div><ShieldCheck size={20} /></div>
        <p className="muted-copy">The complete plan is hashed and shown in Approvals. Text is typed literally and never treated as instructions. Submit, send, delete, purchase, permission, and coordinate clicks are blocked.</p>
        <div className="gui-fields">
          <label><span>GUI agent</span><select aria-label="GUI agent" value={agentId} onChange={(event) => setAgentId(event.target.value)}>{snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>)}</select></label>
          <label><span>Target app</span><select aria-label="Target app" value={targetApp} onChange={(event) => setTargetApp(event.target.value)}><option value="">Choose an approved app…</option>{approvedApps.map((app) => <option key={app} value={app}>{app}</option>)}</select></label>
          <label className="wide"><span>Objective</span><textarea aria-label="GUI objective" value={objective} maxLength={500} onChange={(event) => setObjective(event.target.value)} /></label>
          <label><span>Safe-step retries</span><select aria-label="GUI retries" value={maxRetries} onChange={(event) => setMaxRetries(Number(event.target.value))}><option value="0">None</option><option value="1">1 retry</option><option value="2">2 retries</option></select></label>
        </div>
        <div className="step-list"><span className="field-title">Structured steps</span>{steps.map((step, index) => <div className="gui-step" key={`${index}-${step.type}`}>
          <span>{index + 1}</span>
          <select aria-label={`GUI step ${index + 1} type`} value={step.type} disabled={index === 0} onChange={(event) => changeStep(index, event.target.value as GuiStep['type'])}>
            <option value="activateApp">Activate approved app</option><option value="wait">Wait</option><option value="clickElement">Click named button</option><option value="typeText">Type exact text</option><option value="pressKey">Press navigation key</option>
          </select>
          {step.type === 'activateApp' ? <input value={targetApp || 'Approved target app'} readOnly aria-label="Activation target" /> : null}
          {step.type === 'wait' ? <input aria-label={`GUI step ${index + 1} milliseconds`} type="number" min="100" max="10000" value={step.durationMs} onChange={(event) => updateStep(index, { type: 'wait', durationMs: Number(event.target.value) })} /> : null}
          {step.type === 'clickElement' ? <input aria-label={`GUI step ${index + 1} button label`} value={step.label} onChange={(event) => updateStep(index, { type: 'clickElement', label: event.target.value })} /> : null}
          {step.type === 'typeText' ? <input aria-label={`GUI step ${index + 1} exact text`} value={step.text} onChange={(event) => updateStep(index, { type: 'typeText', text: event.target.value })} /> : null}
          {step.type === 'pressKey' ? <select aria-label={`GUI step ${index + 1} key`} value={step.key} onChange={(event) => updateStep(index, { type: 'pressKey', key: event.target.value as Extract<GuiStep, { type: 'pressKey' }>['key'] })}><option value="tab">Tab</option><option value="escape">Escape</option><option value="arrowUp">Arrow up</option><option value="arrowDown">Arrow down</option><option value="arrowLeft">Arrow left</option><option value="arrowRight">Arrow right</option></select> : null}
          {index > 0 ? <button className="icon-button" aria-label={`Remove GUI step ${index + 1}`} onClick={() => setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button> : <span />}
        </div>)}</div>
        <div className="gui-plan-actions"><button className="ghost-button" disabled={steps.length >= 20} onClick={() => setSteps((current) => [...current, { type: 'wait', durationMs: 600 }])}><Plus size={14} /> Add step</button><button className="primary-button" disabled={busy || snapshot.gui.emergencyStopped || accessibility !== 'granted' || screenRecording !== 'granted' || !agentId || !targetApp || !objective.trim()} onClick={() => void prepare()}><ShieldCheck size={14} /> Send GUI plan to approvals</button></div>
        {!approvedApps.length ? <div className="inline-warning"><CircleAlert size={15} /> Edit this agent and add an exact app name under Approved apps first.</div> : null}
      </section>

      <section className="panel live-view">
        <div className="panel-heading"><div><span className="eyebrow">Live evidence</span><h3>{activeSession ? activeSession.targetApp : 'GUI lane'}</h3></div>{activeSession ? <StatusPill status={activeSession.status} /> : null}</div>
        <EvidencePreview evidence={latestEvidence} />
        {activeSession ? <><p className="live-objective">{activeSession.objective}</p><div className="routine-meta"><span>Step {activeSession.currentStep} of {activeSession.totalSteps}</span><span>Plan {activeSession.planHash.slice(0, 10)}</span><span>{snapshot.gui.evidence.filter((item) => item.sessionId === activeSession.id).length} captures</span></div>{activeSession.pauseReason ? <div className="inline-warning"><Pause size={14} /> {activeSession.pauseReason}</div> : null}<div className="button-row">
          {activeSession.status === 'running' ? <button className="secondary-button" onClick={() => void onAction(() => window.splittbot.gui.pause(activeSession.id))}><Pause size={14} /> Pause</button> : null}
          {activeSession.status === 'paused' ? <button className="primary-button" onClick={() => void onAction(() => window.splittbot.gui.resume(activeSession.id))}><Play size={14} /> Resume</button> : null}
          {['running', 'paused'].includes(activeSession.status) ? <button className="danger-button" onClick={() => void onAction(() => window.splittbot.gui.takeover(activeSession.id))}><Hand size={14} /> Take over</button> : null}
          {activeSession.status === 'pendingApproval' ? <button className="primary-button" onClick={onOpenApprovals}>Review approval</button> : null}
        </div></> : <Empty icon={<Monitor />} title="The GUI lane is ready" detail="Prepare a plan to see its visible progress and verification captures here." />}
      </section>
    </div>

    <section className="gui-history"><div className="panel-heading"><div><span className="eyebrow">Sessions</span><h3>Computer-control history</h3></div><span>{snapshot.gui.sessions.length}</span></div>{snapshot.gui.sessions.length ? snapshot.gui.sessions.map((session) => <article key={session.id}><span className={`status-orb ${session.status}`} /><div><strong>{session.targetApp} · {session.objective}</strong><small>{snapshot.agents.find((agent) => agent.id === session.agentId)?.name ?? 'Agent'} · {formatTime(session.createdAt)} · {session.currentStep}/{session.totalSteps} steps</small></div><StatusPill status={session.status} /></article>) : <Empty icon={<ScreenShare />} title="No GUI sessions" detail="Every prepared and executed plan will remain visible here." />}</section>
  </Page>
}

function PermissionCard({ title, status, detail, onRequest, onSettings, busy }: { title: string; status: AppSnapshot['gui']['permissions']['accessibility']; detail: string; onRequest: () => Promise<void>; onSettings: () => Promise<void>; busy: boolean }): JSX.Element {
  return <div className="permission-card"><span className={`integration-icon ${status === 'granted' ? 'active' : 'paused'}`}><ShieldCheck size={18} /></span><div><span className="eyebrow">macOS permission</span><h3>{title}</h3><p>{detail}</p><div className="button-row"><StatusPill status={status} />{status !== 'granted' ? <><button className="secondary-button" disabled={busy} onClick={() => void onRequest()}>Request</button><button className="ghost-button" disabled={busy} onClick={() => void onSettings()}>Open Settings</button></> : null}</div></div></div>
}

function EvidencePreview({ evidence }: { evidence: GuiEvidence | null }): JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    setDataUrl(null)
    if (evidence) void window.splittbot.gui.evidenceDataUrl(evidence.id).then((value) => { if (current) setDataUrl(value) }).catch(() => undefined)
    return () => { current = false }
  }, [evidence?.id])
  return <div className="evidence-frame">{dataUrl ? <img src={dataUrl} alt="Latest GUI verification evidence" /> : <div><Monitor size={30} /><strong>{evidence ? 'Loading verification capture…' : 'No capture yet'}</strong><span>{evidence ? evidence.summary : 'The live view appears after an approved plan starts.'}</span></div>}{evidence ? <small>{evidence.kind} · {formatTime(evidence.createdAt)}</small> : null}</div>
}

function NotificationsView({ snapshot, onAction }: { snapshot: AppSnapshot; onAction: (action: () => Promise<unknown>) => Promise<void> }): JSX.Element {
  return <Page title="Notifications" eyebrow="Routine outcomes" detail="Completion, failure, and missed-run notices are stored locally and can also appear in macOS Notification Center."><div className="page-actions"><button className="secondary-button" onClick={() => void onAction(() => window.splittbot.notifications.markAllRead())}>Mark all read</button></div><div className="notification-list">{snapshot.notifications.length ? snapshot.notifications.map((notification) => <button className={`notification-row ${notification.read ? 'read' : ''}`} key={notification.id} onClick={() => void onAction(() => window.splittbot.notifications.markRead(notification.id))}><span className="integration-icon"><Bell size={17} /></span><span><strong>{notification.title}</strong><p>{notification.body}</p><small>{formatTime(notification.createdAt)}</small></span>{notification.read ? null : <i />}</button>) : <Empty icon={<Bell />} title="No notifications" detail="Routine outcomes will appear here." />}</div></Page>
}

function ApprovalsView({ snapshot, onResolve }: { snapshot: AppSnapshot; onResolve: (id: string, decision: 'approve' | 'decline' | 'cancel') => Promise<void> }): JSX.Element {
  return <Page title="Approvals" eyebrow="Human control" detail="Review the exact request before Codex, a local Shortcut, or a GUI-control plan can continue."><div className="approval-list">{snapshot.approvals.length ? snapshot.approvals.map((approval) => <article className={`approval-card ${approval.status}`} key={approval.id}><div className="approval-mark"><ShieldCheck size={20} /></div><div className="approval-copy"><div className="approval-top"><div><span className="eyebrow">{approvalKind(approval.method)}</span><h3>{approval.title}</h3></div><StatusPill status={approval.status} /></div><p>{approval.summary}</p><details><summary>Inspect exact request</summary><pre>{JSON.stringify(approval.request, null, 2)}</pre></details><div className="approval-meta">Requested {formatTime(approval.createdAt)} · {snapshot.agents.find((agent) => agent.id === approval.agentId)?.name || 'Codex'}</div>{approval.status === 'pending' ? <div className="approval-actions"><button className="secondary-button" onClick={() => void onResolve(approval.id, 'decline')}><X size={15} /> Decline</button><button className="primary-button" onClick={() => void onResolve(approval.id, 'approve')}><Check size={15} /> Approve once</button></div> : null}</div></article>) : <Empty icon={<ShieldCheck />} title="Nothing is waiting" detail="Approval requests from agents will appear here." />}</div></Page>
}

function ArtifactsView({ snapshot }: { snapshot: AppSnapshot }): JSX.Element {
  return <Page title="Artifacts" eyebrow="Saved results" detail="Durable outputs from your agents, kept locally."><div className="artifact-grid">{snapshot.artifacts.length ? snapshot.artifacts.map((artifact) => <article className="artifact-card" key={artifact.id}><div className="artifact-icon"><FileText size={20} /></div><span className="eyebrow">{artifact.kind}</span><h3>{artifact.name}</h3><p>{artifact.content.slice(0, 180)}{artifact.content.length > 180 ? '…' : ''}</p><div>{snapshot.agents.find((agent) => agent.id === artifact.agentId)?.name || 'Agent'} · {formatTime(artifact.createdAt)}</div></article>) : <Empty icon={<FileText />} title="No artifacts saved" detail="Save a useful agent response to keep it here." />}</div></Page>
}

function AuditView({ snapshot }: { snapshot: AppSnapshot }): JSX.Element {
  return <Page title="Audit history" eyebrow="Local accountability" detail="An append-only product record of agent, user, and system events."><div className="timeline">{snapshot.audit.length ? snapshot.audit.map((event) => <div className="timeline-row" key={event.id}><span className={`timeline-icon ${event.actor}`}>{event.actor === 'user' ? 'U' : event.actor === 'agent' ? 'A' : 'S'}</span><div><strong>{event.summary}</strong><span>{event.type} · {formatTime(event.createdAt)}</span></div></div>) : <Empty icon={<History />} title="No audit events" detail="Events will be recorded as you work." />}</div></Page>
}

function SettingsView({ snapshot, onSignIn, onSignOut, onRefresh }: { snapshot: AppSnapshot; onSignIn: () => void; onSignOut: () => Promise<void>; onRefresh: () => void }): JSX.Element {
  return <Page title="Settings" eyebrow="Local runtime" detail="Your ChatGPT identity and Codex models stay outside the renderer."><div className="settings-grid"><section className="settings-card"><div className="settings-icon"><Bot /></div><div><span className="eyebrow">ChatGPT account</span><h3>{snapshot.account.email || (snapshot.account.state === 'authenticated' ? 'Connected account' : 'Not signed in')}</h3><p>{snapshot.account.state === 'authenticated' ? `${snapshot.account.planType || 'ChatGPT'} plan · Codex-managed authentication` : snapshot.account.error || 'Connect through the browser. SplittBot never asks for an API key.'}</p><div className="button-row">{snapshot.account.state === 'authenticated' ? <button className="secondary-button" onClick={() => void onSignOut()}><LogOut size={15} /> Sign out</button> : <button className="primary-button" onClick={onSignIn}><LogIn size={15} /> Sign in with ChatGPT</button>}<button className="ghost-button" onClick={onRefresh}>Check connection</button></div></div></section><section className="settings-card"><div className="settings-icon"><Sparkles /></div><div><span className="eyebrow">Available models</span><h3>{snapshot.models.length} models discovered</h3><div className="model-tags">{snapshot.models.slice(0, 8).map((model) => <span key={model.id}>{model.displayName}</span>)}</div></div></section><section className="settings-card"><div className="settings-icon"><ShieldCheck /></div><div><span className="eyebrow">Runtime boundary</span><h3>{snapshot.account.runtimeSource || 'Codex runtime'}</h3><p>Credentials remain in the Codex-managed store. SplittBot uses typed IPC, renderer isolation, local SQLite, and secret-redacted logs.</p></div></section></div></Page>
}

function MentionTextarea({ value, onChange, agents, currentAgentId, placeholder, ariaLabel, onKeyDown }: {
  value: string
  onChange: (value: string) => void
  agents: Agent[]
  currentAgentId: string | null
  placeholder: string
  ariaLabel: string
  onKeyDown?: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void
}): JSX.Element {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(value.length)
  const mention = mentionAt(value, caret)
  const teammates = agents.filter((agent) => agent.id !== currentAgentId)
  const matching = mention ? teammates.filter((agent) => agent.name.toLocaleLowerCase().startsWith(mention.query.toLocaleLowerCase())).slice(0, 6) : []
  const showAll = Boolean(mention && 'all'.startsWith(mention.query.toLocaleLowerCase()))

  function insertMention(name: string): void {
    if (!mention) return
    const next = `${value.slice(0, mention.start)}@${name} ${value.slice(caret)}`
    const nextCaret = mention.start + name.length + 2
    onChange(next)
    setCaret(nextCaret)
    requestAnimationFrame(() => {
      textarea.current?.focus()
      textarea.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  return <div className="mention-input">
    <textarea
      ref={textarea}
      value={value}
      onChange={(event) => { onChange(event.target.value); setCaret(event.target.selectionStart) }}
      onClick={(event) => setCaret(event.currentTarget.selectionStart)}
      onKeyUp={(event) => setCaret(event.currentTarget.selectionStart)}
      onKeyDown={(event) => {
        if (event.key === 'Tab' && mention && (matching[0] || showAll)) {
          event.preventDefault()
          insertMention(matching[0]?.name || 'all')
          return
        }
        onKeyDown?.(event)
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
    {mention && (matching.length || showAll) ? <div className="mention-menu" role="listbox" aria-label="Agent mentions">
      {showAll ? <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention('all')}><span className="mention-all"><Users size={14} /></span><span><strong>@all</strong><small>Invite every active agent</small></span></button> : null}
      {matching.map((agent) => <button type="button" key={agent.id} onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(agent.name)}><Avatar agent={agent} /><span><strong>@{agent.name}</strong><small>{agent.role}</small></span></button>)}
    </div> : null}
  </div>
}

function AgentEditor({ value, agents, models, connectors, skills, shortcuts, fallbackCwd, onClose, onSave, onArchive }: {
  value: Agent | 'new'
  agents: Agent[]
  models: AppSnapshot['models']
  connectors: AppSnapshot['connectors']
  skills: AppSnapshot['skills']
  shortcuts: AppSnapshot['shortcuts']
  fallbackCwd: string
  onClose: () => void
  onSave: (input: AgentInput) => Promise<void>
  onArchive?: () => Promise<void>
}): JSX.Element {
  const existing = value === 'new' ? null : value
  const [form, setForm] = useState<AgentInput>(() => existing ? {
    name: existing.name,
    role: existing.role,
    instructions: existing.instructions,
    color: existing.color,
    model: existing.model,
    reasoningEffort: existing.reasoningEffort,
    avatar: existing.avatar,
    collaboratorIds: existing.collaboratorIds,
    cwd: existing.cwd,
    accessMode: existing.accessMode,
    grants: existing.grants
  } : {
    name: '',
    role: '',
    instructions: '',
    color: COLORS[0]!,
    model: null,
    reasoningEffort: null,
    avatar: { type: 'initials', value: null },
    collaboratorIds: [],
    cwd: fallbackCwd,
    accessMode: 'readOnly',
    grants: { readableRoots: [fallbackCwd], writableRoots: [], allowedCommands: [], allowedApps: [], allowedConnectors: [], allowedSkillPaths: [], allowedShortcuts: [], networkAccess: false }
  })
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const teammates = agents.filter((agent) => agent.id !== existing?.id)
  const defaultModel = models.find((model) => model.isDefault) || models[0]
  const selectedModel = form.model ? models.find((model) => model.id === form.model) : defaultModel
  const efforts = selectedModel?.supportedReasoningEfforts ?? []
  const apps = form.grants.allowedApps.join(', ')
  const commands = form.grants.allowedCommands.join(', ')
  const preview = { name: form.name || 'Agent', color: form.color, avatar: form.avatar }

  function updateInstructions(instructions: string): void {
    setForm((current) => ({ ...current, instructions, collaboratorIds: collaboratorIdsFromText(instructions, teammates) }))
  }

  function toggleTeammate(agent: Agent): void {
    const selected = form.collaboratorIds.includes(agent.id)
    const collaboratorIds = selected ? form.collaboratorIds.filter((id) => id !== agent.id) : [...form.collaboratorIds, agent.id]
    const baseInstructions = removeAllAgentMentions(form.instructions, teammates)
    const instructions = collaboratorIds.reduce((text, id) => appendMention(text, teammates.find((candidate) => candidate.id === id)?.name || ''), baseInstructions)
    setForm({ ...form, instructions, collaboratorIds })
  }

  function chooseAvatar(avatar: AgentAvatar): void {
    setForm({ ...form, avatar })
    setAvatarError(null)
  }

  function toggleGrant(key: 'allowedConnectors' | 'allowedSkillPaths' | 'allowedShortcuts', value: string): void {
    const values = form.grants[key]
    setForm({ ...form, grants: { ...form.grants, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] } })
  }

  async function choosePicture(): Promise<void> {
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      const picture = await window.splittbot.avatars.choose()
      if (picture) setForm((current) => ({ ...current, avatar: { type: 'image', value: picture.dataUrl } }))
    } catch (error) {
      setAvatarError(messageOf(error))
    } finally {
      setAvatarBusy(false)
    }
  }

  return <div className="modal-backdrop" role="presentation">
    <div className="modal agent-modal" role="dialog" aria-modal="true" aria-label={existing ? 'Edit agent' : 'Create agent'}>
      <header><div><span className="eyebrow">{existing ? 'Agent profile' : 'New teammate'}</span><h2>{existing ? `Edit ${existing.name}` : 'Create an agent'}</h2><p>Choose this teammate’s identity, intelligence, collaborators, and local boundaries.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
      <div className="form-grid">
        <label><span>Name</span><input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Maya" /></label>
        <label><span>Role</span><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="Account researcher" /></label>

        <div className="wide avatar-field">
          <div className="avatar-preview"><Avatar agent={preview} size="large" /><div><span className="field-title">Avatar or picture</span><small>Use initials, an emoji, or a local image.</small></div></div>
          <div className="avatar-options">
            <button type="button" className={form.avatar.type === 'initials' ? 'selected' : ''} onClick={() => chooseAvatar({ type: 'initials', value: null })}>Aa</button>
            {AVATAR_EMOJIS.map((emoji) => <button type="button" aria-label={`Avatar ${emoji}`} key={emoji} className={form.avatar.type === 'emoji' && form.avatar.value === emoji ? 'selected' : ''} onClick={() => chooseAvatar({ type: 'emoji', value: emoji })}>{emoji}</button>)}
            <button type="button" className={`upload-avatar ${form.avatar.type === 'image' ? 'selected' : ''}`} disabled={avatarBusy} onClick={() => void choosePicture()}>{avatarBusy ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />} Choose picture</button>
          </div>
          {avatarError ? <p className="field-error">{avatarError}</p> : null}
        </div>

        <div className="wide instruction-field"><span className="field-title">Working instructions</span><MentionTextarea value={form.instructions} onChange={updateInstructions} agents={agents} currentAgentId={existing?.id ?? null} placeholder="Own this outcome, cite sources, and tag @AgentName when their specialty is needed…" ariaLabel="Working instructions" /><small>Type @ to choose a teammate. Tags saved here automatically call those agents on each task.</small></div>

        <div className="wide teammate-field"><span className="field-title">Collaboration team</span><div className="teammate-tags"><button type="button" className={teammates.length > 0 && form.collaboratorIds.length === teammates.length ? 'selected' : ''} onClick={() => {
          const allSelected = teammates.length > 0 && form.collaboratorIds.length === teammates.length
          setForm({ ...form, instructions: allSelected ? removeAllAgentMentions(form.instructions, teammates) : appendMention(removeAllAgentMentions(form.instructions, teammates), 'all'), collaboratorIds: allSelected ? [] : teammates.map((agent) => agent.id) })
        }}><Users size={13} /> @all</button>{teammates.map((agent) => <button type="button" key={agent.id} className={form.collaboratorIds.includes(agent.id) ? 'selected' : ''} onClick={() => toggleTeammate(agent)}><Avatar agent={agent} /> @{agent.name}</button>)}</div><small>Every active agent can collaborate; each keeps separate permissions and its own persistent thread.</small></div>

        <label><span>Model</span><select aria-label="Model" value={form.model || ''} onChange={(event) => {
          const model = event.target.value || null
          const nextModel = model ? models.find((item) => item.id === model) : defaultModel
          const effort = form.reasoningEffort && nextModel?.supportedReasoningEfforts.includes(form.reasoningEffort) ? form.reasoningEffort : null
          setForm({ ...form, model, reasoningEffort: effort })
        }}><option value="">Plan default{defaultModel ? ` · ${defaultModel.displayName}` : ''}</option>{models.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}</select></label>
        <label><span>AI effort</span><select aria-label="AI effort" value={form.reasoningEffort || ''} disabled={!efforts.length} onChange={(event) => setForm({ ...form, reasoningEffort: event.target.value || null })}><option value="">Model default{selectedModel?.defaultReasoningEffort ? ` · ${formatEffort(selectedModel.defaultReasoningEffort)}` : ''}</option>{efforts.map((effort) => <option key={effort} value={effort}>{formatEffort(effort)}</option>)}</select></label>
        <label><span>Local access</span><select value={form.accessMode} onChange={(event) => setForm({ ...form, accessMode: event.target.value as AgentInput['accessMode'] })}><option value="readOnly">Read only</option><option value="workspaceWrite">Workspace write</option></select></label>
        <div className="color-field"><span>Color</span><div>{COLORS.map((color) => <button type="button" key={color} aria-label={`Color ${color}`} className={form.color === color ? 'selected' : ''} style={{ background: color }} onClick={() => setForm({ ...form, color })}>{form.color === color ? <Check size={13} /> : null}</button>)}</div></div>
        <label className="wide"><span>Working directory</span><input value={form.cwd} onChange={(event) => setForm({ ...form, cwd: event.target.value, grants: { ...form.grants, readableRoots: [event.target.value] } })} placeholder="/Users/me/project" /></label>
        <label><span>Approved apps</span><input value={apps} onChange={(event) => setForm({ ...form, grants: { ...form.grants, allowedApps: splitList(event.target.value) } })} placeholder="Calendar, Microsoft Word" /></label>
        <label><span>Approved commands</span><input value={commands} onChange={(event) => setForm({ ...form, grants: { ...form.grants, allowedCommands: splitList(event.target.value) } })} placeholder="git status, npm test" /></label>
        <div className="wide teammate-field"><span className="field-title">MCP connector grants</span><div className="teammate-tags">{connectors.filter((connector) => connector.canGrant).length ? connectors.filter((connector) => connector.canGrant).map((connector) => <button type="button" key={connector.name} className={form.grants.allowedConnectors.includes(connector.name) ? 'selected' : ''} onClick={() => toggleGrant('allowedConnectors', connector.name)}><Plug size={13} /> {connector.displayName}</button>) : <small>No grantable connectors configured.</small>}</div><small>Only selected user-configured connectors are enabled in this agent’s Codex thread. Built-in runtime services remain governed by Codex.</small></div>
        <div className="wide teammate-field"><span className="field-title">Reviewed skill grants</span><div className="teammate-tags">{skills.filter((skill) => skill.reviewStatus === 'reviewed').length ? skills.filter((skill) => skill.reviewStatus === 'reviewed').map((skill) => <button type="button" key={skill.path} title={`$${skill.name}`} aria-label={skill.displayName} className={form.grants.allowedSkillPaths.includes(skill.path) ? 'selected' : ''} onClick={() => toggleGrant('allowedSkillPaths', skill.path)}><Workflow size={13} /> {skill.displayName}</button>) : <small>Approve skills in Tools before granting them.</small>}</div><small>Explicit $skill tags and scheduled skill runs are rejected unless reviewed and granted here.</small></div>
        <div className="wide teammate-field"><span className="field-title">Apple Shortcut grants</span><div className="teammate-tags">{shortcuts.length ? shortcuts.map((shortcut) => <button type="button" key={shortcut.name} className={form.grants.allowedShortcuts.includes(shortcut.name) ? 'selected' : ''} onClick={() => toggleGrant('allowedShortcuts', shortcut.name)}><Sparkles size={13} /> {shortcut.name}</button>) : <small>No Shortcuts discovered.</small>}</div><small>Every run still requires one fresh approval with the exact input visible.</small></div>
        <label className="check-label wide"><input type="checkbox" checked={form.grants.networkAccess} onChange={(event) => setForm({ ...form, grants: { ...form.grants, networkAccess: event.target.checked } })} /><span>Allow network access for this agent</span></label>
      </div>
      <footer>{onArchive ? <button className="danger-button archive-action" onClick={() => void onArchive()}><Archive size={15} /> Archive agent</button> : null}<button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving || !form.name.trim() || !form.role.trim() || !form.instructions.trim()} onClick={async () => { setSaving(true); try { await onSave(form) } finally { setSaving(false) } }}>{saving ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} {existing ? 'Save changes' : 'Create agent'}</button></footer>
    </div>
  </div>
}

function Page({ title, eyebrow, detail, children }: { title: string; eyebrow: string; detail: string; children: ReactNode }): JSX.Element { return <div className="page scroll-page"><header className="page-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div></header>{children}</div> }
function Empty({ icon, title, detail }: { icon: JSX.Element; title: string; detail: string }): JSX.Element { return <div className="empty"><span>{icon}</span><strong>{title}</strong><p>{detail}</p></div> }
function StatusPill({ status }: { status: string }): JSX.Element { return <span className={`status-pill ${status}`}>{statusText(status)}</span> }
function RunCompact({ run, agent }: { run: Run; agent?: Agent }): JSX.Element { return <div className="run-compact"><span className={`status-orb ${run.status}`} /><div><strong>{run.input}</strong><span>{agent?.name || 'Agent'} · {formatTime(run.startedAt)}</span></div><ChevronRight size={15} /></div> }

function statusText(status: string): string {
  return ({ queued: 'Queued', running: 'Working', waitingApproval: 'Needs approval', pendingApproval: 'Needs approval', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', pending: 'Waiting', approved: 'Approved', declined: 'Declined', expired: 'Expired', ready: 'Ready', active: 'Active', paused: 'Paused', takeover: 'Takeover', stopped: 'Stopped', granted: 'Granted', denied: 'Denied', notDetermined: 'Not determined', restricted: 'Restricted', unavailable: 'Unavailable', missed: 'Missed', reviewed: 'Reviewed', unreviewed: 'Unreviewed', blocked: 'Blocked' } as Record<string, string>)[status] || status
}
function formatTime(value: string): string { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function splitList(value: string): string[] { return value.split(',').map((item) => item.trim()).filter(Boolean) }
function formatEffort(value: string): string { return value.split(/[-_]/).map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : '').join(' ') }

function mentionAt(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret)
  const match = before.match(/(?:^|\s)@([^\s@]*)$/)
  if (!match) return null
  return { start: before.lastIndexOf('@'), query: match[1] ?? '' }
}

function collaboratorIdsFromText(text: string, agents: Agent[]): string[] {
  if (hasMention(text, 'all')) return agents.map((agent) => agent.id)
  return agents.filter((agent) => hasMention(text, agent.name)).map((agent) => agent.id)
}

function hasMention(text: string, name: string): boolean {
  return new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=$|[\\s,.:;!?()])`, 'i').test(text)
}

function appendMention(text: string, name: string): string {
  if (!name || hasMention(text, name)) return text
  return `${text.trimEnd()}${text.trim() ? ' ' : ''}@${name} `
}

function removeMention(text: string, name: string): string {
  return text.replace(new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=$|[\\s,.:;!?()])`, 'gi'), '$1').replace(/[ \t]{2,}/g, ' ').trim()
}

function removeAllAgentMentions(text: string, agents: Agent[]): string {
  return agents.reduce((current, agent) => removeMention(current, agent.name), removeMention(text, 'all'))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function approvalKind(method: string): string {
  if (method === 'local.shortcut.run') return 'Apple Shortcut'
  if (method === 'local.gui.session') return 'Computer control'
  if (method.includes('command')) return 'Local command'
  if (method.includes('fileChange')) return 'File change'
  if (method.includes('elicitation') || method.includes('tool/requestUserInput')) return 'Connector question'
  if (method.includes('permissions')) return 'Permission request'
  return 'Approval request'
}
