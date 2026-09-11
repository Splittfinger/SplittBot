import { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import {
  Archive,
  Bot,
  Boxes,
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Gauge,
  Hand,
  History,
  Inbox,
  ListTodo,
  LoaderCircle,
  LogIn,
  LogOut,
  MessageSquareText,
  Monitor,
  PanelRight,
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
  Search,
  Square,
  TriangleAlert,
  Trash2,
  Upload,
  Users,
  Workflow,
  X
} from 'lucide-react'
import type { ActionItem, ActionItemCreateInput, ActionRecipe, Agent, AgentAvatar, AgentInput, AppEvent, AppSnapshot, ChatImageAttachment, ConnectorInput, GuiEvidence, GuiSessionInput, GuiStep, Message, RoutineInput, Run, WorkspaceInput } from '../../shared/contracts'
import { LatestRefresh } from '../../shared/async-control'

type RunFilter = 'all' | 'active' | 'completed' | 'failed'
type ActionFilter = 'open' | 'decision' | 'due' | 'waiting' | 'closed' | 'all'
const isActiveRun = (run: Run): boolean => ['queued', 'running', 'waitingApproval'].includes(run.status)

type Section = 'home' | 'actions' | 'agents' | 'workspaces' | 'runs' | 'routines' | 'integrations' | 'computer' | 'approvals' | 'notifications' | 'artifacts' | 'memory' | 'audit' | 'settings'
const SECTION_TITLES: Record<Section, string> = { home: 'Home', actions: 'Action Center', agents: 'Agents', workspaces: 'Workspaces', runs: 'Run history', routines: 'Routines', integrations: 'Tools & connections', computer: 'Computer control', approvals: 'Approvals', notifications: 'Notifications', artifacts: 'Artifacts', memory: 'Memory', audit: 'Audit trail', settings: 'Settings' }
type AgentScheduleDraft = { id: string | null; input: Omit<RoutineInput, 'agentId'> }
type AgentScheduleForm = {
  id: string | null
  title: string
  prompt: string
  scheduleKind: 'interval' | 'daily'
  intervalMinutes: number
  timeOfDay: string
  daysOfWeek: number[]
  catchUpPolicy: RoutineInput['catchUpPolicy']
  notifyPolicy: RoutineInput['notifyPolicy']
  maxRetries: number
  skillPath: string
}

const COLORS = ['#7657d8', '#d1654b', '#16876f', '#3f71c7', '#a56827', '#9a4d82']
const AVATAR_EMOJIS = ['🤖', '🦊', '🐼', '🧭', '🔬', '🎨', '🛠️', '🧠']

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('home')
  const [agentSearch, setAgentSearch] = useState('')
  const [runDestination, setRunDestination] = useState<{ filter: RunFilter; id: string | null; revision: number }>({ filter: 'all', id: null, revision: 0 })
  const [actionDestination, setActionDestination] = useState<{ id: string | null; runId: string | null; revision: number }>({ id: null, runId: null, revision: 0 })
  const [approvalFilter, setApprovalFilter] = useState<'pending' | 'all'>('pending')
  const navigateRuns = (filter: RunFilter = 'all', id: string | null = null): void => {
    setRunDestination((current) => ({ filter, id, revision: current.revision + 1 }))
    setSection('runs')
  }
  const navigateActions = (id: string | null = null, runId: string | null = null): void => {
    setActionDestination((current) => ({ id, runId, revision: current.revision + 1 }))
    setSection('actions')
  }
  const navigateAgents = (id?: string): void => {
    setAgentSearch('')
    if (id) setSelectedAgentId(id)
    setSection('agents')
  }
  const navigateSection = (next: Section): void => {
    if (next === 'runs') navigateRuns()
    else if (next === 'actions') navigateActions()
    else if (next === 'agents') navigateAgents()
    else {
      if (next === 'approvals') setApprovalFilter('pending')
      setSection(next)
    }
  }
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [agentAttachments, setAgentAttachments] = useState<Record<string, ChatImageAttachment[]>>({})
  const composer = selectedAgentId ? drafts[selectedAgentId] ?? '' : ''
  const attachments = selectedAgentId ? agentAttachments[selectedAgentId] ?? [] : []
  const setComposer = (value: string): void => {
    if (selectedAgentId) setDrafts((current) => ({ ...current, [selectedAgentId]: value }))
  }
  const setAttachments = (update: (current: ChatImageAttachment[]) => ChatImageAttachment[]): void => {
    if (selectedAgentId) setAgentAttachments((current) => ({ ...current, [selectedAgentId]: update(current[selectedAgentId] ?? []) }))
  }
  const [streaming, setStreaming] = useState<Record<string, string>>({})
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agentEditor, setAgentEditor] = useState<Agent | 'new' | null>(null)
  const [importPickerOpen, setImportPickerOpen] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [conversationMessages, setConversationMessages] = useState<Record<string, Message[]>>({})
  const [busy, setBusy] = useState(false)

  const selection = useRef(selectedAgentId)
  selection.current = selectedAgentId
  const [snapshotRefresh] = useState(() => new LatestRefresh<string | null>(async (agentId) => {
    try {
      const next = await window.splittbot.bootstrap(agentId ?? undefined)
      if (agentId === selection.current) setSnapshot(next)
      if (agentId) {
        setConversationMessages((current) => ({
          ...current,
          [agentId]: next.messages.filter((message) => message.agentId === agentId)
        }))
      }
      if (agentId === selection.current) {
        setSelectedAgentId((current) => current ?? next.agents[0]?.id ?? null)
        const finished = new Set(next.runs.filter((run) => ['completed', 'failed', 'cancelled'].includes(run.status)).map((run) => run.id))
        setStreaming((current) => Object.fromEntries(Object.entries(current).filter(([runId]) => !finished.has(runId))))
      }
    } catch (caught) {
      setError(messageOf(caught))
    }
  }))
  const refresh = useCallback((agentId?: string | null) => snapshotRefresh.request(agentId ?? selection.current), [snapshotRefresh])

  useEffect(() => {
    void refresh(selectedAgentId)
  }, [selectedAgentId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedAgentId) return
    const agentId = selectedAgentId
    let cancelled = false
    void window.splittbot.chat.listMessages(agentId)
      .then((messages) => {
        if (!cancelled) setConversationMessages((current) => ({ ...current, [agentId]: messages }))
      })
      .catch((caught) => {
        if (!cancelled) {
          setConversationMessages((current) => ({ ...current, [agentId]: [] }))
          setError(messageOf(caught))
        }
      })
    return () => { cancelled = true }
  }, [selectedAgentId])

  useEffect(() => {
    const pendingDeltas = new Map<string, string>()
    let frame: number | null = null
    const unsubscribe = window.splittbot.events.subscribe((event: AppEvent) => {
    if (event.type === 'run:delta') {
      pendingDeltas.set(event.runId, `${pendingDeltas.get(event.runId) ?? ''}${event.delta}`)
      if (frame === null) frame = requestAnimationFrame(() => {
        const deltas = [...pendingDeltas]
        pendingDeltas.clear()
        frame = null
        setStreaming((current) => {
          const next = { ...current }
          for (const [runId, delta] of deltas) next[runId] = `${next[runId] ?? ''}${delta}`
          return next
        })
      })
      return
    }
    if (event.type === 'runtime:warning') {
      setWarning(event.message)
      return
    }
    if (event.type === 'run:completed') {
      pendingDeltas.delete(event.runId)
    }
    void refresh()
    })
    return () => {
      unsubscribe()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [refresh])

  const selectedAgent = snapshot?.agents.find((agent) => agent.id === selectedAgentId) ?? null
  const selectedMessages = selectedAgentId ? conversationMessages[selectedAgentId] ?? [] : []
  const selectedConversationReady = selectedAgentId ? Object.prototype.hasOwnProperty.call(conversationMessages, selectedAgentId) : false
  const selectedRuns = snapshot?.runs.filter((run) => run.agentId === selectedAgentId) ?? []
  const activeRun = selectedRuns.find((run) => ['queued', 'running', 'waitingApproval'].includes(run.status)) ?? null
  const pendingApprovals = snapshot?.approvals.filter((approval) => approval.status === 'pending') ?? []
  const openActions = snapshot?.actions.filter((action) => action.status !== 'done' && action.status !== 'dismissed') ?? []
  const unreadNotifications = snapshot?.notifications.filter((notification) => !notification.read) ?? []

  async function openImports(): Promise<void> {
    if (importBusy) return
    setImportBusy(true)
    setError(null)
    try {
      const imports = await window.splittbot.imports.refresh()
      setSnapshot((current) => current ? { ...current, imports } : current)
      setImportPickerOpen(true)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setImportBusy(false)
    }
  }

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
    if (!selectedAgent || (!composer.trim() && !attachments.length) || busy) return
    setBusy(true)
    setError(null)
    try {
      await window.splittbot.chat.send(selectedAgent.id, composer, attachments.map((attachment) => attachment.id))
      setDrafts((current) => current[selectedAgent.id] === composer ? { ...current, [selectedAgent.id]: '' } : current)
      const sent = new Set(attachments.map((attachment) => attachment.id))
      setAgentAttachments((current) => ({ ...current, [selectedAgent.id]: (current[selectedAgent.id] ?? []).filter((attachment) => !sent.has(attachment.id)) }))
      await refresh(selectedAgent.id)
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  async function attachImages(): Promise<void> {
    const agentId = selectedAgentId
    if (!agentId) return
    setError(null)
    try {
      const selected = await window.splittbot.chat.chooseImages()
      setAgentAttachments((current) => ({ ...current, [agentId]: [...(current[agentId] ?? []), ...selected].slice(0, 4) }))
    } catch (caught) {
      setError(messageOf(caught))
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
    return <div className="splash"><div className="brand-mark"><Sparkles size={24} /></div>{error ? <><p role="alert">Could not load your agent desk: {error}</p><button className="primary-button" onClick={() => { setError(null); void refresh() }}>Try again</button></> : <><LoaderCircle className="spin" /> Starting your agent desk…</>}</div>
  }

  return (
    <div className="app-shell" data-section={section}>
      <aside className="rail" aria-label="Workspace sidebar">
        <div className="drag-region" />
        <div className="logo" title="SplittBot">
          <span className="logo-symbol"><Sparkles size={18} strokeWidth={2.4} /></span>
          <span className="logo-copy"><strong>SplittBot</strong><small>Agent workspace</small></span>
        </div>
        <button className="sidebar-create" aria-label="New agent" title="New agent" onClick={() => setAgentEditor('new')}><Plus size={17} /><span>New agent</span></button>
        <nav className="rail-nav" aria-label="Primary navigation">
          <div className="rail-group">
            <span className="rail-section-label">Workspace</span>
            <RailButton active={section === 'home'} label="Home" icon={<Gauge />} onClick={() => setSection('home')} />
            <RailButton active={section === 'actions'} label="Actions" icon={<ListTodo />} count={openActions.length} onClick={() => navigateActions()} />
            <RailButton active={section === 'agents'} label="Agents" icon={<Bot />} onClick={() => navigateAgents()} />
            <RailButton active={section === 'workspaces'} label="Workspaces" icon={<Users />} onClick={() => setSection('workspaces')} />
            <RailButton active={section === 'runs'} label="Runs" icon={<Play />} onClick={() => navigateRuns()} />
          </div>
          <div className="rail-group">
            <span className="rail-section-label">Automate</span>
            <RailButton active={section === 'routines'} label="Routines" icon={<CalendarClock />} onClick={() => setSection('routines')} />
            <RailButton active={section === 'integrations'} label="Tools" icon={<Plug />} onClick={() => setSection('integrations')} />
            <RailButton active={section === 'computer'} label="Computer" icon={<Monitor />} onClick={() => setSection('computer')} />
            <RailButton active={section === 'approvals'} label="Approvals" icon={<Inbox />} count={pendingApprovals.length} onClick={() => navigateSection('approvals')} />
          </div>
          <div className="rail-group">
            <span className="rail-section-label">Activity</span>
            <RailButton active={section === 'notifications'} label="Notifications" icon={<Bell />} count={unreadNotifications.length} onClick={() => setSection('notifications')} />
            <RailButton active={section === 'artifacts'} label="Artifacts" icon={<Boxes />} onClick={() => setSection('artifacts')} />
            <RailButton active={section === 'memory'} label="Memory" icon={<FileText />} onClick={() => setSection('memory')} />
            <RailButton active={section === 'audit'} label="Audit" icon={<History />} onClick={() => setSection('audit')} />
          </div>
        </nav>
        <div className="rail-spacer" />
        <RailButton active={section === 'settings'} label="Settings" icon={<Settings />} onClick={() => setSection('settings')} />
        <UsageFooter account={snapshot.account} />
      </aside>

      <aside className="team-pane">
        <div className="team-header">
          <div>
            <span className="eyebrow">Your workspace</span>
            <h1>Agent team</h1>
          </div>
          <span className="team-count">{snapshot.agents.length}</span>
        </div>
        <label className="agent-search"><Search size={14} /><input aria-label="Search agents" placeholder="Find an agent" value={agentSearch} onChange={(event) => setAgentSearch(event.target.value)} /></label>
        <button className="attention-card" onClick={() => navigateSection(openActions.length ? 'actions' : 'approvals')}>
          <div className="attention-icon">{openActions.length ? <ListTodo size={17} /> : <ShieldCheck size={17} />}</div>
          <div><strong>{openActions.length ? `${openActions.length} action${openActions.length === 1 ? '' : 's'} open` : pendingApprovals.length ? `${pendingApprovals.length} need review` : 'All clear'}</strong><span>{openActions.length ? `${pendingApprovals.length} approval${pendingApprovals.length === 1 ? '' : 's'} waiting` : pendingApprovals.length ? 'Agents are waiting for you' : 'No actions or approvals are waiting'}</span></div>
          <ChevronRight size={16} />
        </button>
        <div className="pane-label"><span>Agents</span><span>{snapshot.agents.length}</span></div>
        <div className="agent-list">
          {snapshot.agents.filter((agent) => `${agent.name} ${agent.role}`.toLocaleLowerCase().includes(agentSearch.trim().toLocaleLowerCase())).map((agent) => {
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
        {agentSearch && !snapshot.agents.some((agent) => `${agent.name} ${agent.role}`.toLocaleLowerCase().includes(agentSearch.trim().toLocaleLowerCase())) ? <p className="roster-empty">No matching agents.</p> : null}
        <div className="team-bottom-note"><Users size={15} /><span>Better, together.<small>Tag @teammates in any conversation.</small></span></div>
      </aside>

      <main className="main-pane">
        {section !== 'agents' ? <div className="window-toolbar"><div className="toolbar-location"><span>Workspace</span><ChevronRight size={13} /><strong>{SECTION_TITLES[section]}</strong></div><div className="toolbar-controls"><span className="local-status"><span className={`runtime-dot ${snapshot.account.state}`} />Local on your Mac</span><button className="icon-button" aria-label="Review pending approvals" title="Review pending approvals" onClick={() => navigateSection('approvals')}><ShieldCheck size={17} /></button></div></div> : null}
        {error ? <Banner tone="error" text={error} onClose={() => setError(null)} /> : null}
        {warning ? <Banner tone="warning" text={warning} onClose={() => setWarning(null)} /> : null}
        {snapshot.account.state === 'signedOut' ? <SignInBanner onSignIn={() => void startLogin()} /> : null}
        {section === 'home' ? <Home snapshot={snapshot} onOpen={navigateSection} onOpenAgent={navigateAgents} onOpenAction={navigateActions} onOpenRun={(id) => navigateRuns('all', id)} onWorkingNow={() => navigateRuns('active')} onCreateAgent={() => setAgentEditor('new')} /> : null}
        {section === 'actions' ? <ActionsView key={actionDestination.revision} snapshot={snapshot} busy={busy} initialId={actionDestination.id} initialRunId={actionDestination.runId} onAction={runAction} onOpenRun={(id) => navigateRuns('all', id)} /> : null}
        {section === 'agents' && selectedAgent && selectedConversationReady ? (
          <AgentConversation
            key={selectedAgent.id}
            agent={selectedAgent}
            agents={snapshot.agents}
            routines={snapshot.routines}
            messages={selectedMessages}
            runs={selectedRuns}
            actions={snapshot.actions}
            streaming={streaming}
            composer={composer}
            setComposer={setComposer}
            attachments={attachments}
            onAttach={() => void attachImages()}
            onRemoveAttachment={(id) => setAttachments((current) => current.filter((attachment) => attachment.id !== id))}
            onSend={() => void sendMessage()}
            onEdit={() => setAgentEditor(selectedAgent)}
            onCancel={activeRun ? () => void window.splittbot.chat.cancel(activeRun.id) : undefined}
            onSaveArtifact={(message) => void window.splittbot.artifacts.create({ agentId: selectedAgent.id, runId: message.runId, name: `${selectedAgent.name} response`, content: message.content })}
            onCreateAction={(message, content) => void runAction(async () => {
              const defaults = manualActionDefaults(content)
              const created = await window.splittbot.actions.create({ ...defaults, sourceAgentId: selectedAgent.id, sourceRunId: message.runId, ownerAgentId: null, workspaceId: null, dueAt: null, evidence: content })
              navigateActions(created.id)
            })}
            onOpenActions={(runId) => navigateActions(null, runId)}
            onOpenAgent={navigateAgents}
            sourceMonitor={snapshot.imports.monitored.find((source) => source.targetKind === 'agent' && source.targetId === selectedAgent.id)}
            busy={busy}
          />
        ) : null}
        {section === 'agents' && selectedAgent && !selectedConversationReady ? <ConversationLoading agent={selectedAgent} /> : null}
        {section === 'agents' && !selectedAgent ? <Page title="Build your team" eyebrow="Agents" detail="Create a bot with a role and instructions to begin."><button className="primary-button" onClick={() => setAgentEditor('new')}><Plus size={15} /> Create your first agent</button></Page> : null}
        {section === 'runs' ? <RunsView key={runDestination.revision} runs={snapshot.runs} agents={snapshot.agents} initialFilter={runDestination.filter} initialId={runDestination.id} onOpenAgent={navigateAgents} onOpenApprovals={() => navigateSection('approvals')} onOpenActions={(runId) => navigateActions(null, runId)} /> : null}
        {section === 'workspaces' ? <WorkspacesView snapshot={snapshot} busy={busy} onAction={runAction} /> : null}
        {section === 'routines' ? <RoutinesView snapshot={snapshot} busy={busy} onAction={runAction} /> : null}
        {section === 'integrations' ? <IntegrationsView snapshot={snapshot} busy={busy} onAction={runAction} /> : null}
        {section === 'computer' ? <GuiControlView snapshot={snapshot} busy={busy} onAction={runAction} onOpenApprovals={() => setSection('approvals')} /> : null}
        {section === 'approvals' ? <ApprovalsView snapshot={snapshot} filter={approvalFilter} onFilter={setApprovalFilter} onAction={runAction} onOpenAgent={() => navigateAgents()} /> : null}
        {section === 'notifications' ? <NotificationsView snapshot={snapshot} onAction={runAction} onOpenRun={(id) => navigateRuns('all', id)} onOpenAgent={navigateAgents} onOpenApprovals={() => navigateSection('approvals')} /> : null}
        {section === 'artifacts' ? <ArtifactsView snapshot={snapshot} onOpenRun={(id) => navigateRuns('all', id)} onOpenAgent={navigateAgents} /> : null}
        {section === 'memory' ? <MemoryView snapshot={snapshot} busy={busy} onAction={runAction} /> : null}
        {section === 'audit' ? <AuditView snapshot={snapshot} /> : null}
        {section === 'settings' ? <SettingsView snapshot={snapshot} importBusy={importBusy} onSignIn={() => void startLogin()} onSignOut={async () => { await window.splittbot.auth.signOut(); await refresh(selectedAgentId) }} onRefresh={() => void refresh(selectedAgentId)} onOpenImports={() => void openImports()} /> : null}
      </main>

      {agentEditor ? <AgentEditor value={agentEditor} agents={snapshot.agents} models={snapshot.models} connectedApps={snapshot.connectedApps} connectors={snapshot.connectors} connectorAccounts={snapshot.connectorAccounts} skills={snapshot.skills} shortcuts={snapshot.shortcuts} routines={snapshot.routines} fallbackCwd={selectedAgent?.cwd || '/Users'} onClose={() => setAgentEditor(null)} onSave={async (input, scheduleDraft) => {
        try {
          const saved = agentEditor === 'new' ? await window.splittbot.agents.create(input) : await window.splittbot.agents.update(agentEditor.id, input)
          if (scheduleDraft) {
            const routineInput: RoutineInput = { ...scheduleDraft.input, agentId: saved.id }
            if (scheduleDraft.id) await window.splittbot.routines.update(scheduleDraft.id, routineInput)
            else await window.splittbot.routines.create(routineInput)
          }
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
      {importPickerOpen ? <ImportPicker catalog={snapshot.imports} onClose={() => setImportPickerOpen(false)} onImported={async () => {
        setImportPickerOpen(false)
        await refresh(selectedAgentId)
      }} onRefreshed={() => void refresh(selectedAgentId)} /> : null}
    </div>
  )
}

function RailButton({ active, label, icon, count, onClick }: { active: boolean; label: string; icon: JSX.Element; count?: number; onClick: () => void }): JSX.Element {
  return <button className={`rail-button ${active ? 'active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined} title={label} onClick={onClick}>{icon}<span className="rail-label">{label}</span>{count ? <span className="rail-count">{count}</span> : null}</button>
}

function UsageFooter({ account }: { account: AppSnapshot['account'] }): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const usageAvailable = account.state === 'authenticated' && account.usage.state === 'available' && account.usage.buckets.length > 0
  const primaryBucket = account.usage.buckets.find((bucket) => bucket.id === 'codex') ?? account.usage.buckets[0] ?? null
  const summaryWindow = primaryBucket ? mostUsedWindow(primaryBucket.primary, primaryBucket.secondary) : null
  const remaining = summaryWindow ? Math.max(0, 100 - summaryWindow.usedPercent) : null
  const plan = formatPlanName(account.planType || primaryBucket?.planType || account.authMode || 'ChatGPT')

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    if (!usageAvailable) setOpen(false)
  }, [usageAvailable])

  const detail = account.state !== 'authenticated'
    ? account.runtimeSource || 'Local runtime'
    : usageAvailable && summaryWindow && remaining !== null
      ? `${remaining}% left${summaryWindow.resetsAt ? ` · resets ${formatResetTime(summaryWindow.resetsAt, true)}` : ''}`
      : 'Usage unavailable'
  const buttonLabel = account.state === 'authenticated'
    ? `Codex connected, ${plan} plan, ${usageAvailable && remaining !== null ? `${remaining}% remaining` : 'usage unavailable'}`
    : 'Codex needs attention'

  return <div className="team-footer" ref={rootRef}>
    <button
      type="button"
      className="usage-summary"
      aria-label={buttonLabel}
      aria-expanded={usageAvailable ? open : undefined}
      aria-controls={usageAvailable ? 'codex-usage-details' : undefined}
      aria-haspopup={usageAvailable ? 'dialog' : undefined}
      disabled={!usageAvailable}
      onClick={() => setOpen((current) => !current)}
    >
      <span className={`runtime-dot ${account.state}`} />
      <span className="usage-summary-copy">
        <span className="usage-title-row"><strong>{account.state === 'authenticated' ? 'Codex connected' : 'Codex needs attention'}</strong><span className="usage-plan">{plan}</span></span>
        {usageAvailable && summaryWindow ? <span className="usage-meter-row">
          <span className="usage-meter" role="progressbar" aria-label="Codex allowance used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summaryWindow.usedPercent}>
            <span className={usageSeverity(summaryWindow.usedPercent)} style={{ width: `${summaryWindow.usedPercent}%` }} />
          </span>
          <small>{detail}</small>
        </span> : <small className="usage-unavailable">{detail}</small>}
      </span>
      {usageAvailable ? <ChevronRight className={`usage-chevron ${open ? 'open' : ''}`} size={14} /> : null}
    </button>
    {usageAvailable && open ? <section id="codex-usage-details" className="usage-popover" role="dialog" aria-label="Codex usage details">
      <header className="usage-popover-header">
        <span className="usage-popover-icon"><Gauge size={16} /></span>
        <span><strong>Codex usage</strong><small>{plan} plan · live account limits</small></span>
        <button type="button" aria-label="Close usage details" onClick={() => setOpen(false)}><X size={14} /></button>
      </header>
      <div className="usage-bucket-list">
        {account.usage.buckets.map((bucket) => <article className="usage-bucket" key={bucket.id}>
          <div className="usage-bucket-title"><strong>{usageBucketName(bucket.id, bucket.name)}</strong>{bucket.limitReachedReason || bucket.spendControlReached ? <span className="usage-limit-alert">Limit reached</span> : null}</div>
          {bucket.primary ? <UsageWindowRow window={bucket.primary} /> : null}
          {bucket.secondary ? <UsageWindowRow window={bucket.secondary} /> : null}
        </article>)}
      </div>
      {primaryBucket?.credits || account.usage.resetCreditsAvailable ? <div className="usage-credit-row">
        <span><strong>{creditSummary(primaryBucket?.credits)}</strong><small>Purchased credits</small></span>
        {account.usage.resetCreditsAvailable ? <span><strong>{account.usage.resetCreditsAvailable}</strong><small>{account.usage.resetCreditsAvailable === 1 ? 'reset available' : 'resets available'}</small></span> : null}
      </div> : null}
      <footer>Updated {formatFetchedTime(account.usage.fetchedAt)} · Quota is reported by your signed-in Codex account.</footer>
    </section> : null}
  </div>
}

function UsageWindowRow({ window }: { window: NonNullable<AppSnapshot['account']['usage']['buckets'][number]['primary']> }): JSX.Element {
  const remaining = Math.max(0, 100 - window.usedPercent)
  const label = formatUsageWindow(window.windowDurationMinutes)
  return <div className="usage-window-row">
    <div className="usage-window-copy"><strong>{label}</strong><small>{remaining}% remaining{window.resetsAt ? ` · resets ${formatResetTime(window.resetsAt)}` : ''}</small></div>
    <div className="usage-window-meter" role="progressbar" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={window.usedPercent}>
      <span className={usageSeverity(window.usedPercent)} style={{ width: `${window.usedPercent}%` }} />
    </div>
  </div>
}

function mostUsedWindow(...windows: Array<AppSnapshot['account']['usage']['buckets'][number]['primary']>): NonNullable<AppSnapshot['account']['usage']['buckets'][number]['primary']> | null {
  return windows.filter((window): window is NonNullable<typeof window> => Boolean(window)).sort((left, right) => right.usedPercent - left.usedPercent)[0] ?? null
}

function usageSeverity(usedPercent: number): string {
  return usedPercent >= 90 ? 'critical' : usedPercent >= 75 ? 'warning' : 'normal'
}

function usageBucketName(id: string, name: string | null): string {
  if (name) return name
  if (id === 'codex') return 'All Codex models'
  return id.replace(/^codex[_-]?/i, '').replaceAll(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Codex'
}

function formatUsageWindow(minutes: number | null): string {
  if (!minutes) return 'Current window'
  if (minutes === 10_080) return '7-day window'
  if (minutes % 10_080 === 0) return `${minutes / 10_080}-week window`
  if (minutes % 1_440 === 0) return `${minutes / 1_440}-day window`
  if (minutes % 60 === 0) return `${minutes / 60}-hour window`
  return `${minutes}-minute window`
}

function formatResetTime(epochSeconds: number, compact = false): string {
  const date = new Date(epochSeconds * 1_000)
  if (Number.isNaN(date.getTime())) return 'later'
  return new Intl.DateTimeFormat(undefined, compact
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatFetchedTime(value: string | null): string {
  if (!value) return 'recently'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'recently' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatPlanName(value: string): string {
  return value.replaceAll(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function creditSummary(credits: AppSnapshot['account']['usage']['buckets'][number]['credits'] | null | undefined): string {
  if (!credits) return 'None'
  if (credits.unlimited) return 'Unlimited'
  return credits.balance ? `${credits.balance} credits` : credits.hasCredits ? 'Available' : 'None'
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

function Home({ snapshot, onOpen, onOpenAgent, onOpenAction, onOpenRun, onWorkingNow, onCreateAgent }: { snapshot: AppSnapshot; onOpen: (section: Section) => void; onOpenAgent: (id: string) => void; onOpenAction: (id: string) => void; onOpenRun: (id: string) => void; onWorkingNow: () => void; onCreateAgent: () => void }): JSX.Element {
  const active = snapshot.runs.filter(isActiveRun)
  const complete = snapshot.runs.filter((run) => run.status === 'completed').slice(0, 4)
  const pending = snapshot.approvals.filter((approval) => approval.status === 'pending')
  const openActions = snapshot.actions.filter((action) => action.status !== 'done' && action.status !== 'dismissed')
  const actions = openActions.slice(0, 4)
  return <div className="page scroll-page home-page">
    <header className="page-title home-title"><div><span className="eyebrow">Your day, with a little more space.</span><h2>Good to see you.</h2><p>Your team handles the details. You decide what comes next.</p></div><div className="home-date"><CalendarDays size={16} /><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span></div></header>
    <section className="metric-grid" aria-label="Workspace shortcuts">
      <Metric icon={<Bot />} label="Active agents" value={String(snapshot.agents.length)} accent="violet" hint={snapshot.agents.length ? 'Open your team' : 'Create an agent'} onClick={() => snapshot.agents.length ? onOpen('agents') : onCreateAgent()} />
      <Metric icon={<LoaderCircle />} label="Working now" value={String(active.length)} accent="blue" hint="View current work" onClick={onWorkingNow} />
      <Metric icon={<ListTodo />} label="Needs attention" value={String(openActions.length)} accent="amber" hint="Open your action queue" onClick={() => onOpen('actions')} />
      <Metric icon={<ShieldCheck />} label="Need approval" value={String(pending.length)} accent="green" hint="Review pending requests" onClick={() => onOpen('approvals')} />
    </section>
    <section className="panel home-actions-panel">
      <div className="panel-heading"><div><span className="eyebrow">Chief of Staff queue</span><h3>Needs your attention</h3></div><button className="text-button" onClick={() => onOpen('actions')}>Open Action Center <ChevronRight size={14} /></button></div>
      {actions.length ? <div className="home-action-grid">{actions.map((action) => <ActionCompact key={action.id} action={action} agent={snapshot.agents.find((agent) => agent.id === action.sourceAgentId)} onOpen={() => onOpenAction(action.id)} />)}</div> : <Empty icon={<CheckCircle2 />} title="Nothing is slipping through" detail="Decisions, follow-ups, risks, and tasks found in agent results will stay here until resolved." />}
    </section>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Live desk</span><h3>Agents</h3></div><button className="text-button" onClick={() => onOpen('agents')}>Open team <ChevronRight size={14} /></button></div>
        <div className="home-agent-grid">{snapshot.agents.map((agent) => { const run = active.find((item) => item.agentId === agent.id); return <button className="home-agent" key={agent.id} onClick={() => onOpenAgent(agent.id)} aria-label={`Open ${agent.name}`}><Avatar agent={agent} /><div><strong>{agent.name}</strong><span>{agent.role}</span></div><span className="ready-pill">{run ? statusText(run.status) : 'Ready'}</span><ChevronRight size={15} /></button> })}</div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Recent results</span><h3>Completed work</h3></div><button className="text-button" onClick={() => onOpen('runs')}>All runs <ChevronRight size={14} /></button></div>
        {complete.length ? <div className="result-list">{complete.map((run) => <RunCompact key={run.id} run={run} agent={snapshot.agents.find((agent) => agent.id === run.agentId)} onOpen={() => onOpenRun(run.id)} />)}</div> : <Empty icon={<Clock3 />} title="No completed runs yet" detail="Give an agent its first task to see results here." />}
      </section>
    </div>
  </div>
}

function Metric({ icon, label, value, accent, hint, onClick }: { icon: JSX.Element; label: string; value: string; accent: string; hint: string; onClick: () => void }): JSX.Element {
  return <button type="button" className={`metric ${accent}`} aria-label={`${label}: ${value}. ${hint}`} onClick={onClick}><span className="metric-icon">{icon}</span><div><strong>{value}</strong><span>{label}</span><small>{hint}</small></div><ChevronRight size={15} className="metric-chevron" /></button>
}

function ActionCompact({ action, agent, onOpen }: { action: ActionItem; agent?: Agent; onOpen: () => void }): JSX.Element {
  return <button className="action-compact" aria-label={`Open action: ${action.title}`} onClick={onOpen}>
    <span className={`action-type-icon ${action.type}`}>{actionIcon(action.type)}</span>
    <span className="action-compact-copy"><span><em className={`priority-dot ${action.priority}`} />{actionTypeLabel(action.type)} · {agent?.name || 'Agent'}</span><strong>{action.title}</strong><small>{action.dueAt ? `Due ${formatTime(action.dueAt)}` : `Updated ${formatTime(action.lastSeenAt)}`}</small></span>
    <ChevronRight size={15} />
  </button>
}

function ActionsView({ snapshot, busy, initialId, initialRunId, onAction, onOpenRun }: { snapshot: AppSnapshot; busy: boolean; initialId: string | null; initialRunId: string | null; onAction: (action: () => Promise<unknown>) => Promise<void>; onOpenRun: (id: string) => void }): JSX.Element {
  const [filter, setFilter] = useState<ActionFilter>(initialRunId || snapshot.actions.some((action) => action.id === initialId && isClosedAction(action)) ? 'all' : 'open')
  const [sourceRunId, setSourceRunId] = useState(initialRunId)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(initialId ?? snapshot.actions.find((action) => !isClosedAction(action))?.id ?? snapshot.actions[0]?.id ?? '')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = snapshot.actions.filter((action) => {
    if (sourceRunId && action.sourceRunId !== sourceRunId) return false
    if (filter === 'due' && (isClosedAction(action) || !action.dueAt || Date.parse(action.dueAt) > Date.now() + 24 * 60 * 60_000)) return false
    if (filter === 'open' && isClosedAction(action)) return false
    if (filter === 'decision' && (action.type !== 'decision' || isClosedAction(action))) return false
    if (filter === 'waiting' && !['waiting', 'blocked'].includes(action.status)) return false
    if (filter === 'closed' && !isClosedAction(action)) return false
    return !normalizedQuery || `${action.title} ${action.summary}`.toLocaleLowerCase().includes(normalizedQuery)
  })
  const selected = filtered.find((action) => action.id === selectedId) ?? filtered[0] ?? null
  const open = snapshot.actions.filter((action) => !isClosedAction(action))
  const dueSoon = open.filter((action) => action.dueAt && Date.parse(action.dueAt) <= Date.now() + 24 * 60 * 60_000)
  const waiting = open.filter((action) => ['waiting', 'blocked'].includes(action.status))

  return <div className="page scroll-page actions-page">
    <header className="page-title"><div><span className="eyebrow">Chief of Staff queue</span><h2>Action Center</h2><p>Decisions, follow-ups, risks, and tasks stay visible across every agent run.</p></div><div className="action-summary" aria-label="Action shortcuts">{([{ filter: 'open', label: 'Open', count: open.length }, { filter: 'decision', label: 'Decisions', count: open.filter((action) => action.type === 'decision').length }, { filter: 'due', label: 'Due soon', count: dueSoon.length }, { filter: 'waiting', label: 'Waiting', count: waiting.length }] as const).map((item) => <button type="button" key={item.filter} aria-label={`Show ${item.label.toLowerCase()} actions: ${item.count}`} aria-pressed={filter === item.filter && !sourceRunId && !query} onClick={() => { setSourceRunId(null); setQuery(''); setFilter(item.filter) }}><strong>{item.count}</strong>{item.label}<ChevronRight size={11} /></button>)}</div></header>
    <div className="action-toolbar">
      <div className="segmented-control" aria-label="Filter actions">{(['open', 'decision', 'due', 'waiting', 'closed', 'all'] as const).map((value) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'decision' ? 'Decisions' : value === 'due' ? 'Due soon' : value[0]!.toLocaleUpperCase() + value.slice(1)}</button>)}</div>
      <label className="action-search"><Search size={15} /><input aria-label="Find an action" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an action" /></label>
    </div>
    {sourceRunId ? <div className="source-filter">Actions captured from this result<button className="text-button" onClick={() => { setSourceRunId(null); setQuery(''); setFilter('open') }}>Show all open actions</button></div> : null}
    <div className="action-center-layout">
      <section className="action-list" aria-label="Action list">
        {filtered.length ? filtered.map((action) => <button key={action.id} className={`action-card ${selected?.id === action.id ? 'selected' : ''}`} onClick={() => setSelectedId(action.id)}>
          <span className={`action-type-icon ${action.type}`}>{actionIcon(action.type)}</span>
          <span className="action-card-copy"><span><em className={`priority-dot ${action.priority}`} />{actionTypeLabel(action.type)} · {actionStatusLabel(action.status)}</span><strong>{action.title}</strong><small>{snapshot.agents.find((agent) => agent.id === action.sourceAgentId)?.name ?? 'Agent'} · {action.dueAt ? `due ${formatTime(action.dueAt)}` : `seen ${formatTime(action.lastSeenAt)}`}</small></span>
          <ChevronRight size={15} />
        </button>) : <Empty icon={<ListTodo />} title="No matching actions" detail={snapshot.actions.length ? 'Try another view or search.' : 'SplittBot will capture explicit unresolved items from completed agent results. You can also create one from any response.'} />}
      </section>
      {selected ? <ActionDetail key={`${selected.id}:${selected.lastSeenAt}`} action={selected} snapshot={snapshot} busy={busy} onAction={onAction} onOpenRun={onOpenRun} /> : <section className="panel action-empty-detail"><CheckCircle2 size={28} /><h3>{open.length ? 'No actions in this view' : 'Your queue is clear'}</h3><p>{open.length ? 'Choose another filter to see the rest of your queue.' : 'Important findings will remain here even after an agent runs again.'}</p><button className="secondary-button" onClick={() => { setSourceRunId(null); setQuery(''); setFilter('all') }}>View all actions</button></section>}
    </div>
  </div>
}

function ActionDetail({ action, snapshot, busy, onAction, onOpenRun }: { action: ActionItem; snapshot: AppSnapshot; busy: boolean; onAction: (action: () => Promise<unknown>) => Promise<void>; onOpenRun: (id: string) => void }): JSX.Element {
  const [status, setStatus] = useState(action.status)
  const [priority, setPriority] = useState(action.priority)
  const [ownerAgentId, setOwnerAgentId] = useState(action.ownerAgentId ?? '')
  const [workspaceId, setWorkspaceId] = useState(action.workspaceId ?? '')
  const [dueAt, setDueAt] = useState(action.dueAt ? toLocalDateTime(action.dueAt) : '')
  const [resolution, setResolution] = useState(action.resolution ?? '')
  const sourceAgent = snapshot.agents.find((agent) => agent.id === action.sourceAgentId)
  const sourceAccount = snapshot.connectorAccounts.find((account) => account.id === action.sourceAccountId)
  const sourceRoutine = snapshot.routines.find((routine) => routine.id === action.sourceRoutineId)
  const events = snapshot.actionEvents.filter((event) => event.actionId === action.id)
  const latestResult = events.find((event) => typeof event.detail.result === 'string' && event.detail.result)?.detail.result
  const closed = isClosedAction(action)
  const suggestions: Array<{ recipe: ActionRecipe; label: string; detail: string; icon: JSX.Element }> = [
    { recipe: 'recommend', label: 'Ask Atlas', detail: 'Options, tradeoffs, and a recommendation', icon: <Sparkles size={16} /> },
    { recipe: 'investigate', label: 'Investigate', detail: 'Gather current read-only evidence', icon: <Search size={16} /> },
    { recipe: 'draft', label: 'Draft next step', detail: 'Prepare a reply, checklist, or decision note', icon: <FileText size={16} /> },
    { recipe: 'meeting', label: 'Prepare meeting', detail: 'Agenda and possible times; no invite sent', icon: <CalendarDays size={16} /> },
    { recipe: 'moveForward', label: 'Move forward safely', detail: 'Prepare the exact step and stop for approval', icon: <ChevronRight size={16} /> }
  ]

  return <section className="panel action-detail">
    <div className="action-detail-heading"><span className={`action-type-icon large ${action.type}`}>{actionIcon(action.type)}</span><div><span className="eyebrow">{actionTypeLabel(action.type)} · {action.priority} priority</span><h3>{action.title}</h3></div><StatusPill status={action.status} /></div>
    <div className="action-provenance">
      <span><strong>Source</strong>{sourceAgent?.name || 'Agent'}</span>
      <span><strong>First raised</strong>{formatTime(action.firstSeenAt)}</span>
      <span><strong>Last observed</strong>{formatTime(action.lastSeenAt)}</span>
      {sourceAccount ? <span><strong>Account</strong>{sourceAccount.label}{sourceAccount.accountIdentifier ? ` · ${sourceAccount.accountIdentifier}` : ''}</span> : null}
      {sourceRoutine ? <span><strong>Routine</strong>{sourceRoutine.title}</span> : null}
    </div>
    <div className="action-brief"><span className="field-title">What you need to action</span><p>{action.summary}</p></div>
    {latestResult ? <div className="action-result"><span className="eyebrow">Latest agent guidance</span><p>{String(latestResult)}</p></div> : null}
    {!closed ? <div className="action-ai-section"><div><span className="field-title">AI-assisted next steps</span><p>These start a bounded research or drafting turn. External changes still require a fresh approval.</p></div><div className="action-ai-grid">{suggestions.map((suggestion) => <button key={suggestion.recipe} disabled={busy || action.status === 'waiting'} onClick={() => void onAction(() => window.splittbot.actions.start(action.id, suggestion.recipe))}>{suggestion.icon}<span><strong>{suggestion.label}</strong><small>{suggestion.detail}</small></span></button>)}</div></div> : null}
    <div className="action-controls">
      <label><span>Status</span><select aria-label="Action status" value={status} onChange={(event) => setStatus(event.target.value as ActionItem['status'])}>{(['inbox', 'next', 'waiting', 'scheduled', 'blocked', 'done', 'dismissed'] as const).map((value) => <option key={value} value={value}>{actionStatusLabel(value)}</option>)}</select></label>
      <label><span>Priority</span><select aria-label="Action priority" value={priority} onChange={(event) => setPriority(event.target.value as ActionItem['priority'])}>{(['urgent', 'high', 'normal', 'low'] as const).map((value) => <option key={value} value={value}>{value[0]!.toLocaleUpperCase() + value.slice(1)}</option>)}</select></label>
      <label><span>Owner</span><select aria-label="Action owner" value={ownerAgentId} onChange={(event) => setOwnerAgentId(event.target.value)}><option value="">You / unassigned</option>{snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
      <label><span>Workspace</span><select aria-label="Action workspace" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}><option value="">No workspace</option>{snapshot.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>
      <label className="wide"><span>Review or due date</span><input aria-label="Action due date" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
      <label className="wide"><span>Resolution note · optional</span><textarea aria-label="Action resolution" value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="What resolved this, or what outcome should be remembered?" /></label>
      <div className="action-control-buttons wide"><button className="primary-button" disabled={busy || (status === 'scheduled' && !dueAt)} onClick={() => void onAction(() => window.splittbot.actions.update(action.id, { status, priority, ownerAgentId: ownerAgentId || null, workspaceId: workspaceId || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null, resolution: resolution.trim() || null }))}>Save changes</button>{!closed ? <button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.actions.update(action.id, { status: 'done', resolution: resolution.trim() || 'Marked complete by the user.' }))}><Check size={14} /> Mark done</button> : <button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.actions.update(action.id, { status: 'inbox', resolution: null }))}>Reopen</button>}{!closed ? <button className="ghost-button" disabled={busy} onClick={() => { if (window.confirm('Dismiss this item from the active queue? It will remain in history.')) void onAction(() => window.splittbot.actions.update(action.id, { status: 'dismissed', resolution: 'Dismissed by the user.' })) }}>Dismiss</button> : null}{action.sourceRunId ? <button className="ghost-button" onClick={() => onOpenRun(action.sourceRunId!)}>View source run</button> : null}</div>
    </div>
    <div className="action-evidence"><span className="field-title">Evidence and history</span>{action.evidence.slice().reverse().map((evidence, index) => <article key={`${evidence.observedAt}:${index}`}><p>{evidence.excerpt}</p><small>Observed {formatTime(evidence.observedAt)}</small></article>)}{events.slice(0, 8).map((event) => <article className="action-event" key={event.id}><p>{event.summary}</p><small>{event.actor} · {formatTime(event.createdAt)}</small></article>)}</div>
  </section>
}

function AgentConversation(props: {
  agent: Agent; agents: Agent[]; routines: AppSnapshot['routines']; messages: Message[]; runs: Run[]; actions: ActionItem[]; streaming: Record<string, string>; composer: string; setComposer: (value: string) => void; attachments: ChatImageAttachment[]; onAttach: () => void; onRemoveAttachment: (id: string) => void; onSend: () => void; onEdit: () => void; onCancel?: () => void; onSaveArtifact: (message: Message) => void; onCreateAction: (message: Message, content: string) => void; onOpenActions: (runId: string | null) => void; onOpenAgent: (id: string) => void; sourceMonitor?: AppSnapshot['imports']['monitored'][number]; busy: boolean
}): JSX.Element {
  const { agent, agents, routines, messages, runs, actions, streaming, composer, setComposer, attachments, onAttach, onRemoveAttachment, onSend, onEdit, onCancel, onSaveArtifact, onCreateAction, onOpenActions, onOpenAgent, sourceMonitor, busy } = props
  const streamEntries = Object.entries(streaming).filter(([runId]) => runs.some((run) => run.id === runId))
  const messageListRef = useRef<HTMLDivElement>(null)
  const renderedAgentId = useRef(agent.id)
  const stickToNewest = useRef(true)
  const [showDetails, setShowDetails] = useState(true)
  const lastMessage = messages.at(-1)
  const messageVersion = lastMessage ? `${lastMessage.id}:${lastMessage.content.length}` : 'empty'
  const streamVersion = streamEntries.map(([runId, text]) => `${runId}:${text.length}`).join('|')

  useLayoutEffect(() => {
    const list = messageListRef.current
    if (!list) return
    const agentChanged = renderedAgentId.current !== agent.id
    if (agentChanged) {
      renderedAgentId.current = agent.id
      stickToNewest.current = true
    }
    if (agentChanged || stickToNewest.current) list.scrollTop = list.scrollHeight
  }, [agent.id, messageVersion, streamVersion])

  function sendFromComposer(): void {
    stickToNewest.current = true
    onSend()
  }

  return <div className="conversation" data-details={showDetails ? 'shown' : 'hidden'}>
    <header className="conversation-header">
      <div className="agent-heading"><Avatar agent={agent} size="large" /><div><span className="eyebrow">Direct agent</span><h2>{agent.name}</h2><p>{agent.role}</p></div></div>
      <div className="header-actions"><span className="safety-pill"><ShieldCheck size={14} /> {agent.accessMode === 'readOnly' ? 'Read only' : 'Workspace write'}</span><button className="icon-button" aria-label="Edit agent" title="Edit agent" onClick={onEdit}><Pencil size={17} /></button><button className="icon-button inspector-toggle" aria-label={showDetails ? 'Hide agent details' : 'Show agent details'} aria-pressed={showDetails} title="Toggle agent details" onClick={() => setShowDetails((shown) => !shown)}><PanelRight size={18} /></button></div>
    </header>
    <div className="conversation-body">
      <div className="message-scroll" data-testid="message-list" ref={messageListRef} onScroll={(event) => {
        const list = event.currentTarget
        stickToNewest.current = list.scrollHeight - list.scrollTop - list.clientHeight <= 72
      }}>
        {!messages.length ? <EmptyConversation agent={agent} onChoose={(prompt) => { setComposer(composer.trim() ? `${composer}\n\n${prompt}` : prompt); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.composer-box textarea')?.focus()) }} /> : null}
        {messages.map((message) => <MessageBubble key={message.id} message={message} agent={agent} capturedCount={actions.filter((action) => action.sourceRunId === message.runId).length} onSave={() => onSaveArtifact(message)} onCreate={(content) => onCreateAction(message, content)} onOpenActions={() => onOpenActions(message.runId)} />)}
        {streamEntries.map(([runId, text]) => <div className="message-row agent-message" key={runId}><Avatar agent={agent} /><div className="message-stack"><div className="message-meta"><strong>{agent.name}</strong><span>Working now</span></div><div className="message-card streaming-card">{text || <span className="thinking"><i /><i /><i /></span>}</div></div></div>)}
      </div>
      <AgentInspector agent={agent} agents={agents} runs={runs} routines={routines.filter((routine) => routine.agentId === agent.id)} sourceMonitor={sourceMonitor} onEdit={onEdit} onOpenAgent={onOpenAgent} />
    </div>
    <div className="composer-wrap">
      <div className="composer-box">
        {attachments.length ? <div className="attachment-chips">{attachments.map((attachment) => <span key={attachment.id}><FileText size={12} /><span><strong>{attachment.name}</strong><small>{formatBytes(attachment.size)} · image</small></span><button aria-label={`Remove ${attachment.name}`} onClick={() => onRemoveAttachment(attachment.id)}><X size={12} /></button></span>)}</div> : null}
        <MentionTextarea value={composer} onChange={setComposer} agents={agents} currentAgentId={agent.id} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendFromComposer() } }} placeholder={`Message ${agent.name}… Tag @teammates to collaborate.`} ariaLabel={`Message ${agent.name}`} />
        <div className="composer-actions"><div><button className="composer-tool" aria-label="Attach images" title="Attach up to four PNG, JPEG, or WebP images" disabled={busy || attachments.length >= 4} onClick={onAttach}><Plus size={17} /></button><span>Enter to send · Shift+Enter for a new line</span></div>{onCancel ? <button className="stop-button" onClick={onCancel}><Square size={13} fill="currentColor" /> Stop</button> : <button className="send-button" aria-label="Send" disabled={(!composer.trim() && !attachments.length) || busy} onClick={sendFromComposer}>{busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}</button>}</div>
      </div>
      <p className="composer-note">Tag @AgentName or @all to collaborate. Every agent keeps their own model, effort, workspace, and permissions.</p>
    </div>
  </div>
}

function ConversationLoading({ agent }: { agent: Agent }): JSX.Element {
  return <div className="conversation conversation-loading" aria-label={`Loading ${agent.name} conversation`}>
    <header className="conversation-header">
      <div className="agent-heading"><Avatar agent={agent} size="large" /><div><span className="eyebrow">Direct agent</span><h2>{agent.name}</h2><p>{agent.role}</p></div></div>
    </header>
    <div className="conversation-loading-body"><LoaderCircle className="spin" size={20} /><span>Opening the latest conversation…</span></div>
  </div>
}

function EmptyConversation({ agent, onChoose }: { agent: Agent; onChoose: (prompt: string) => void }): JSX.Element {
  return <div className="empty-conversation"><Avatar agent={agent} size="large" /><span className="eyebrow">New conversation</span><h3>What should {agent.name} own?</h3><p>{agent.instructions}</p><div className="starter-grid">{['Prepare a brief from this workspace', 'Review a draft without changing it', 'Plan the next three actions'].map((prompt) => <button type="button" key={prompt} onClick={() => onChoose(prompt)}>{prompt}<ChevronRight size={13} /></button>)}</div><small>Choose a starter to draft a message. Nothing runs until you press Send.</small></div>
}

function MessageBubble({ message, agent, capturedCount, onSave, onCreate, onOpenActions }: { message: Message; agent: Agent; capturedCount: number; onSave: () => void; onCreate: (content: string) => void; onOpenActions: () => void }): JSX.Element {
  const isUser = message.role === 'user'
  const isStatus = message.kind === 'status'
  return <div className={`message-row ${isUser ? 'user-message' : 'agent-message'} ${message.kind === 'error' ? 'error-message' : ''} ${isStatus ? 'status-message' : ''}`}>
    {isUser ? <span className="user-avatar">ME</span> : isStatus ? <span className="collaboration-avatar"><Users size={16} /></span> : <Avatar agent={agent} />}
    <div className="message-stack"><div className="message-meta"><strong>{isUser ? 'You' : isStatus ? 'Team handoff' : agent.name}</strong><span>{formatTime(message.createdAt)}</span></div><div className="message-card">{message.content}</div>{!isUser && !isStatus && message.kind !== 'error' ? <div className="response-actions"><button className="save-response" onClick={onSave}><Save size={13} /> Save as artifact</button><button className="save-response" onClick={() => onCreate(window.getSelection()?.toString().trim() || message.content)}><ListTodo size={13} /> Create action{window.getSelection()?.toString().trim() ? ' from selection' : ''}</button>{capturedCount ? <button className="captured-actions" onClick={onOpenActions}>{capturedCount} action{capturedCount === 1 ? '' : 's'} captured <ChevronRight size={12} /></button> : null}</div> : null}</div>
  </div>
}

function AgentInspector({ agent, agents, runs, routines, sourceMonitor, onEdit, onOpenAgent }: { agent: Agent; agents: Agent[]; runs: Run[]; routines: AppSnapshot['routines']; sourceMonitor?: AppSnapshot['imports']['monitored'][number]; onEdit: () => void; onOpenAgent: (id: string) => void }): JSX.Element {
  const lastRun = runs[0]
  const collaborators = agents.filter((candidate) => agent.collaboratorIds.includes(candidate.id))
  return <aside className="inspector">
    <div className="inspector-section"><span className="eyebrow">Current state</span><div className="state-line"><span className={`status-orb ${lastRun?.status || 'ready'}`} /><strong>{lastRun && ['running', 'queued', 'waitingApproval'].includes(lastRun.status) ? statusText(lastRun.status) : 'Ready for a task'}</strong></div></div>
    <div className="inspector-section"><span className="eyebrow">Runtime</span><InspectorLine label="Model" value={agent.model || 'Plan default'} /><InspectorLine label="AI effort" value={agent.reasoningEffort || 'Model default'} /><InspectorLine label="Access" value={agent.accessMode === 'readOnly' ? 'Read only' : 'Workspace write'} /><InspectorLine label="Thread" value={agent.threadId ? `…${agent.threadId.slice(-8)}` : 'Starts on first task'} /></div>
    {sourceMonitor ? <div className="inspector-section"><span className="eyebrow">Linked Codex source</span><InspectorLine label="Status" value={statusText(sourceMonitor.status)} /><InspectorLine label="Last seen" value={sourceMonitor.lastSeenAt ? formatTime(sourceMonitor.lastSeenAt) : 'Not seen yet'} /><p>{sourceMonitor.name}</p></div> : null}
    <div className="inspector-section"><span className="eyebrow">Schedule</span>{routines.length ? routines.map((routine) => <div className="inspector-schedule" key={routine.id}><strong>{routine.title}</strong><span>{formatSchedule(routine.schedule)} · {routine.status === 'active' ? `next ${formatTime(routine.nextRunAt)}` : 'paused'}</span></div>) : <p>No scheduled runs.</p>}<button className="text-button inspector-link" onClick={onEdit}>{routines.length ? 'Manage schedules' : 'Add a schedule'} <ChevronRight size={12} /></button></div>
    <div className="inspector-section"><span className="eyebrow">Collaborators</span><div className="collaborator-list">{collaborators.length ? collaborators.map((candidate) => <button type="button" key={candidate.id} onClick={() => onOpenAgent(candidate.id)}>@{candidate.name}</button>) : <p>Tag any teammate in instructions or chat.</p>}</div></div>
    <div className="inspector-section"><span className="eyebrow">Workspace</span><p className="path-value" title={agent.cwd}>{agent.cwd}</p></div>
    <div className="inspector-section"><span className="eyebrow">Grants</span><div className="grant-list"><span><FileText size={14} /> {agent.grants.readableRoots.length} readable root{agent.grants.readableRoots.length === 1 ? '' : 's'}</span><span><Boxes size={14} /> {agent.grants.allowedApps.length} local app{agent.grants.allowedApps.length === 1 ? '' : 's'}</span><span><Plug size={14} /> {agent.grants.allowedConnectedApps.length} connected app{agent.grants.allowedConnectedApps.length === 1 ? '' : 's'}</span><span><Plug size={14} /> {agent.grants.allowedConnectors.length} custom connector{agent.grants.allowedConnectors.length === 1 ? '' : 's'}</span><span><Users size={14} /> {agent.grants.allowedConnectorAccounts.length} connector account{agent.grants.allowedConnectorAccounts.length === 1 ? '' : 's'}</span><span><Workflow size={14} /> {agent.grants.allowedSkillPaths.length} skill{agent.grants.allowedSkillPaths.length === 1 ? '' : 's'}</span><span><ShieldCheck size={14} /> Network {agent.grants.networkAccess ? 'allowed' : 'blocked'}</span></div></div>
  </aside>
}

function InspectorLine({ label, value }: { label: string; value: string }): JSX.Element { return <div className="inspector-line"><span>{label}</span><strong>{value}</strong></div> }

function RunsView({ runs, agents, initialFilter, initialId, onOpenAgent, onOpenApprovals, onOpenActions }: { runs: Run[]; agents: Agent[]; initialFilter: RunFilter; initialId: string | null; onOpenAgent: (id?: string) => void; onOpenApprovals: () => void; onOpenActions: (runId: string) => void }): JSX.Element {
  const [filter, setFilter] = useState(initialFilter)
  const [selectedId, setSelectedId] = useState(initialId)
  const [archivedRun, setArchivedRun] = useState<Run | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const listedRun = runs.find((run) => run.id === selectedId)
  const detailRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => { detailRef.current?.scrollIntoView({ block: 'start' }) }, [selectedId])
  useEffect(() => {
    let current = true
    setArchivedRun(null)
    setLookupError(null)
    if (selectedId && !listedRun) void window.splittbot.runs.get(selectedId).then((run) => {
      if (!current) return
      setArchivedRun(run)
      if (!run) setLookupError('This run is no longer available in local history.')
    }).catch((error) => { if (current) setLookupError(messageOf(error)) })
    return () => { current = false }
  }, [selectedId, listedRun?.id])
  const selected = listedRun ?? (archivedRun?.id === selectedId ? archivedRun : null)
  const matches = (run: Run): boolean => filter === 'all' || (filter === 'active' ? isActiveRun(run) : run.status === filter)
  const visible = runs.filter(matches)
  const selectedAgent = agents.find((agent) => agent.id === selected?.agentId)
  return <Page title={filter === 'active' ? 'Working now' : 'Runs'} eyebrow="Execution history" detail={filter === 'active' ? 'Open queued, running, or approval-blocked work to see its status and next step.' : 'Open an attempt to read its full request, result, or error.'}>
    <div className="run-toolbar segmented-control" aria-label="Filter runs">{([{ id: 'all', label: 'All runs' }, { id: 'active', label: 'Working now' }, { id: 'completed', label: 'Completed' }, { id: 'failed', label: 'Failed' }] as const).map((item) => <button key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setSelectedId(null) }}>{item.label}</button>)}</div>
    {selectedId ? <section className="panel run-detail" aria-label="Run details" ref={detailRef}><div className="panel-heading"><div><span className="eyebrow">{selectedAgent?.name || 'Run record'}</span><h3>Run details</h3></div><button className="icon-button" aria-label="Close run details" onClick={() => setSelectedId(null)}><X size={16} /></button></div>
      {selected ? <><div className="run-meta"><StatusPill status={selected.status} /><span>Started {formatTime(selected.startedAt)}</span>{selected.completedAt ? <span>Finished {formatTime(selected.completedAt)}</span> : null}</div><h4>Request</h4><pre className="readable-output">{selected.input}</pre><h4>{selected.error ? 'Error' : 'Result'}</h4><pre className="readable-output">{selected.error || selected.output || (isActiveRun(selected) ? 'This task is still in progress. Open the agent conversation for live updates.' : 'No result was recorded for this attempt.')}</pre><div className="button-row">{selectedAgent ? <button className="secondary-button" onClick={() => onOpenAgent(selected.agentId)}>Open agent conversation</button> : <span className="muted-copy">The agent has been archived; its result is preserved here.</span>}{selected.status === 'waitingApproval' ? <button className="primary-button" onClick={onOpenApprovals}>Review pending approvals</button> : null}<button className="ghost-button" onClick={() => onOpenActions(selected.id)}>View captured actions</button></div></> : <p role="status">{lookupError || 'Loading the run record…'}</p>}
    </section> : null}
    <div className="table-panel"><div className="data-table table-head"><span>Agent</span><span>Task · select to open</span><span>Status</span><span>Started</span></div>{visible.length ? visible.map((run) => <button type="button" className={`data-table run-row ${selectedId === run.id ? 'selected' : ''}`} key={run.id} aria-label={`Open run: ${run.input}`} aria-pressed={selectedId === run.id} onClick={() => setSelectedId(run.id)}><span className="table-agent"><span className={`status-orb ${run.status}`} />{agents.find((agent) => agent.id === run.agentId)?.name || 'Archived agent'}</span><span className="truncate">{run.input}</span><span><StatusPill status={run.status} /></span><span>{formatTime(run.startedAt)} <ChevronRight size={12} /></span></button>) : <div className="actionable-empty"><Empty icon={<Play />} title={filter === 'active' ? 'No work is running' : 'No runs in this view'} detail={filter === 'active' ? 'Your team is ready for its next task.' : 'Choose another filter or open an agent to start a task.'} /><div className="button-row"><button className="secondary-button" onClick={() => onOpenAgent()}>Open agents</button>{filter !== 'all' ? <button className="ghost-button" onClick={() => setFilter('all')}>View all runs</button> : null}</div></div>}</div>
  </Page>
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
  const monitoredTasks = snapshot.imports.monitored.filter((source) => source.sourceKind === 'codexAutomation')

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
    {monitoredTasks.length ? <section className="panel monitored-tasks"><div className="panel-heading"><div><span className="eyebrow">Imported from Codex</span><h3>Monitored Codex tasks</h3></div><span className="monitor-count">{monitoredTasks.length}</span></div><p className="muted-copy">Runs remain owned by Codex; SplittBot monitors them without creating a duplicate schedule.</p><div className="monitor-grid">{monitoredTasks.map((source) => <article className="monitor-card" key={source.sourceKey}><span className="integration-icon"><CalendarClock size={17} /></span><div><strong>{source.name}</strong><small>{String(source.detail.scheduleLabel ?? 'Schedule unavailable')} · {source.lastSeenAt ? `seen ${formatTime(source.lastSeenAt)}` : 'not seen yet'}</small></div><StatusPill status={source.status} /></article>)}</div></section> : null}
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
      return <article className="routine-card" key={routine.id}><div className="routine-top"><span className={`integration-icon ${routine.status}`}><CalendarClock size={18} /></span><div><h3>{routine.title}</h3><span>{snapshot.agents.find((item) => item.id === routine.agentId)?.name || 'Agent'}</span></div><StatusPill status={routine.status} /></div><p>{routine.prompt}</p><div className="routine-meta"><span>Next: {formatTime(routine.nextRunAt)}</span><span>{routine.catchUpPolicy === 'runOnce' ? 'Catch up once' : 'Skip missed'}</span><span>{routine.maxRetries} retries</span>{lastAttempt ? <span>Last: {statusText(lastAttempt.status)}</span> : null}</div><div className="button-row"><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.routines.runNow(routine.id))}><Play size={14} /> Run now</button><button className="ghost-button" disabled={busy} onClick={() => edit(routine)}><Pencil size={14} /> Edit</button><button className="ghost-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.routines.setStatus(routine.id, routine.status === 'active' ? 'paused' : 'active'))}>{routine.status === 'active' ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button><button className="ghost-button danger-text" disabled={busy} onClick={() => { if (window.confirm(`Delete the “${routine.title}” routine and its attempt history?`)) void onAction(() => window.splittbot.routines.delete(routine.id)) }}><Trash2 size={14} /> Delete</button></div></article>
    }) : <Empty icon={<CalendarClock />} title="No routines yet" detail="Create an awake-only schedule for an agent." />}</div>
  </Page>
}

function WorkspacesView({ snapshot, busy, onAction }: { snapshot: AppSnapshot; busy: boolean; onAction: (action: () => Promise<unknown>) => Promise<void> }): JSX.Element {
  const [selectedId, setSelectedId] = useState(snapshot.workspaces[0]?.id ?? '')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(snapshot.workspaces.length === 0)
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [ownerId, setOwnerId] = useState(snapshot.agents[0]?.id ?? '')
  const [memberIds, setMemberIds] = useState<string[]>(snapshot.agents[0] ? [snapshot.agents[0].id] : [])
  const [autoCoordinate, setAutoCoordinate] = useState(false)
  const [prompt, setPrompt] = useState('')
  const selected = snapshot.workspaces.find((workspace) => workspace.id === selectedId) ?? snapshot.workspaces[0] ?? null
  const members = selected ? snapshot.agents.filter((agent) => selected.memberIds.includes(agent.id)) : []
  const events = selected ? snapshot.workspaceEvents.filter((event) => event.workspaceId === selected.id) : []

  function edit(workspace = selected): void {
    if (!workspace) return
    setEditingId(workspace.id); setName(workspace.name); setObjective(workspace.objective); setOwnerId(workspace.currentOwnerAgentId); setMemberIds(workspace.memberIds); setAutoCoordinate(workspace.autoCoordinate); setShowEditor(true)
  }

  function createNew(): void {
    setEditingId(null); setName(''); setObjective(''); setOwnerId(snapshot.agents[0]?.id ?? ''); setMemberIds(snapshot.agents[0] ? [snapshot.agents[0].id] : []); setAutoCoordinate(false); setShowEditor(true)
  }

  async function save(): Promise<void> {
    const input: WorkspaceInput = { name, objective, currentOwnerAgentId: ownerId, memberIds, autoCoordinate }
    let savedId = editingId
    await onAction(async () => { const saved = editingId ? await window.splittbot.workspaces.update(editingId, input) : await window.splittbot.workspaces.create(input); savedId = saved.id })
    if (savedId) setSelectedId(savedId)
    setShowEditor(false)
  }

  return <Page title="Group workspaces" eyebrow="Durable team outcomes" detail="Choose an explicit owner and team. @mentions collaborate by default; automatic coordination requires a separate opt-in.">
    <div className="page-actions"><button className="primary-button" onClick={createNew}><Plus size={14} /> New workspace</button></div>
    {showEditor ? <section className="inline-form panel"><div className="form-grid compact-form"><label><span>Name</span><input aria-label="Workspace name" value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Current owner</span><select aria-label="Workspace owner" value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setMemberIds((current) => current.includes(event.target.value) ? current : [...current, event.target.value]) }}>{snapshot.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>)}</select></label><label className="wide"><span>Outcome</span><textarea aria-label="Workspace objective" value={objective} onChange={(event) => setObjective(event.target.value)} /></label><div className="wide teammate-field"><span className="field-title">Members</span><div className="teammate-tags">{snapshot.agents.map((agent) => <button type="button" key={agent.id} className={memberIds.includes(agent.id) ? 'selected' : ''} onClick={() => setMemberIds((current) => current.includes(agent.id) ? current.length === 1 ? current : current.filter((id) => id !== agent.id) : [...current, agent.id])}><Avatar agent={agent} /> @{agent.name}</button>)}</div></div><label className="check-label wide"><input type="checkbox" checked={autoCoordinate} onChange={(event) => setAutoCoordinate(event.target.checked)} /><span>Automatically ask every selected teammate on each task</span></label></div><div className="inline-form-actions"><button className="secondary-button" onClick={() => setShowEditor(false)}>Cancel</button><button className="primary-button" disabled={busy || !name.trim() || !objective.trim() || !ownerId || !memberIds.includes(ownerId)} onClick={() => void save()}>{editingId ? 'Save workspace' : 'Create workspace'}</button></div></section> : null}
    <div className="workspace-layout"><section className="workspace-list">{snapshot.workspaces.length ? snapshot.workspaces.map((workspace) => <button key={workspace.id} className={`workspace-card ${selected?.id === workspace.id ? 'selected' : ''}`} onClick={() => setSelectedId(workspace.id)}><span className="integration-icon"><Users size={18} /></span><span><strong>{workspace.name}</strong><small>{snapshot.agents.find((agent) => agent.id === workspace.currentOwnerAgentId)?.name ?? 'Owner'} · {workspace.memberIds.length} members</small></span><StatusPill status={workspace.status} /></button>) : <Empty icon={<Users />} title="No group workspaces" detail="Create one to coordinate a durable outcome." />}</section>{selected ? <section className="panel workspace-detail"><div className="panel-heading"><div><span className="eyebrow">Current owner · @{snapshot.agents.find((agent) => agent.id === selected.currentOwnerAgentId)?.name}</span><h3>{selected.name}</h3></div><button className="ghost-button" onClick={() => edit()}><Pencil size={14} /> Edit</button></div><p className="muted-copy">{selected.objective}</p><div className="routine-meta"><span>{selected.autoCoordinate ? 'Automatic team coordination on' : 'Mentioned teammates only'}</span>{members.map((agent) => <span key={agent.id}>@{agent.name}</span>)}</div>{selected.status === 'active' ? <div className="workspace-composer"><MentionTextarea value={prompt} onChange={setPrompt} agents={members} currentAgentId={selected.currentOwnerAgentId} placeholder="Assign the next task. Type @ to invite a workspace teammate…" ariaLabel="Workspace task" /><button className="primary-button" disabled={busy || !prompt.trim()} onClick={() => void onAction(async () => { await window.splittbot.workspaces.startTask(selected.id, prompt); setPrompt('') })}><Send size={14} /> Start task</button></div> : null}<div className="button-row"><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.workspaces.setStatus(selected.id, selected.status === 'completed' ? 'active' : 'completed'))}>{selected.status === 'completed' ? 'Reopen' : 'Mark completed'}</button><button className="ghost-button danger-text" disabled={busy} onClick={() => { if (window.confirm(`Archive the “${selected.name}” workspace? Its timeline will remain in the local database.`)) void onAction(() => window.splittbot.workspaces.setStatus(selected.id, 'archived')) }}>Archive</button></div><div className="workspace-timeline"><span className="field-title">Team timeline</span>{events.length ? events.map((event) => <article key={event.id}><span className={`timeline-icon ${event.type === 'contribution' ? 'agent' : 'system'}`}>{event.type.slice(0, 1).toUpperCase()}</span><div><strong>{event.summary}</strong><small>{event.type} · {formatTime(event.createdAt)}</small>{event.type === 'contribution' && typeof event.detail.result === 'string' ? <p>{event.detail.result.slice(0, 280)}{event.detail.result.length > 280 ? '…' : ''}</p> : null}</div></article>) : <p className="muted-copy">Tasks, handoffs, contributions, ownership changes, and completion will appear here.</p>}</div></section> : null}</div>
  </Page>
}

function MemoryView({ snapshot, busy, onAction }: { snapshot: AppSnapshot; busy: boolean; onAction: (action: () => Promise<unknown>) => Promise<void> }): JSX.Element {
  const [agentId, setAgentId] = useState(snapshot.agents[0]?.id ?? '')
  const agent = snapshot.agents.find((entry) => entry.id === agentId) ?? snapshot.agents[0]
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'enabled' | 'disabled'>(agent?.memoryMode ?? 'enabled')
  const [retention, setRetention] = useState(agent?.memoryRetentionDays ? String(agent.memoryRetentionDays) : '')
  const [exported, setExported] = useState<string | null>(null)
  useEffect(() => { if (agent) { setMode(agent.memoryMode); setRetention(agent.memoryRetentionDays ? String(agent.memoryRetentionDays) : '') } }, [agent?.id, agent?.memoryMode, agent?.memoryRetentionDays])
  if (!agent) return <Page title="Agent memory" eyebrow="Review and control" detail="Explicit memory controls appear after an agent exists."><Empty icon={<FileText />} title="No agents" detail="Create an agent first." /></Page>
  const memories = snapshot.memories.filter((memory) => memory.agentId === agent.id)
  return <Page title="Agent memory" eyebrow="Review, retain, export, delete" detail="Manage explicit local notes separately from each agent’s persistent Codex thread."><div className="memory-layout"><section className="panel"><div className="form-grid compact-form"><label><span>Agent</span><select aria-label="Memory agent" value={agent.id} onChange={(event) => setAgentId(event.target.value)}>{snapshot.agents.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label><span>Codex memory</span><select value={mode} onChange={(event) => setMode(event.target.value as 'enabled' | 'disabled')}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label><label><span>Retention days</span><input aria-label="Memory retention days" type="number" min="1" max="3650" value={retention} onChange={(event) => setRetention(event.target.value)} placeholder="Until deleted" /></label><div className="inline-form-actions"><button className="primary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.memories.setPolicy(agent.id, { mode, retentionDays: retention ? Number(retention) : null }))}>Save policy</button></div><label className="wide"><span>New explicit note</span><textarea aria-label="New memory note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="A durable fact this agent should retain…" /></label></div><div className="button-row"><button className="primary-button" disabled={busy || !note.trim()} onClick={() => void onAction(async () => { await window.splittbot.memories.add(agent.id, note); setNote('') })}><Plus size={14} /> Add note</button><button className="secondary-button" disabled={busy} onClick={() => void onAction(async () => { const result = await window.splittbot.memories.export(agent.id); if (result) setExported(result.path) })}>Export memory</button></div>{exported ? <div className="data-notice">Exported to {exported}</div> : null}<div className="button-row"><button className="danger-button" disabled={busy || !memories.length} onClick={() => { if (window.confirm(`Delete every explicit memory note for ${agent.name}?`)) void onAction(() => window.splittbot.memories.clear(agent.id)) }}><Trash2 size={14} /> Clear notes</button><button className="danger-button" disabled={busy || !agent.threadId} onClick={() => { if (window.confirm(`Delete ${agent.name}’s persistent Codex thread? Conversation messages remain in SplittBot, but the next task starts a new Codex thread.`)) void onAction(() => window.splittbot.memories.deleteThread(agent.id)) }}><Trash2 size={14} /> Delete Codex thread</button></div></section><section className="memory-list">{memories.length ? memories.map((memory) => <article className="panel" key={memory.id}><p>{memory.content}</p><small>{memory.source} · {formatTime(memory.createdAt)}</small><button className="ghost-button danger-text" disabled={busy} onClick={() => { if (window.confirm('Delete this memory note?')) void onAction(() => window.splittbot.memories.delete(memory.id)) }}><Trash2 size={13} /> Delete</button></article>) : <Empty icon={<FileText />} title="No explicit notes" detail="Persistent Codex thread memory and explicit local notes are controlled separately." />}</section></div></Page>
}

function IntegrationsView({ snapshot, busy, onAction }: { snapshot: AppSnapshot; busy: boolean; onAction: (action: () => Promise<unknown>) => Promise<void> }): JSX.Element {
  const [tab, setTab] = useState<'connectors' | 'skills' | 'shortcuts'>('connectors')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [appSearch, setAppSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [connectorName, setConnectorName] = useState('')
  const [transport, setTransport] = useState<'streamableHttp' | 'stdio'>('streamableHttp')
  const [endpoint, setEndpoint] = useState('')
  const [connectorArgs, setConnectorArgs] = useState('')
  const accountSources = snapshot.connectors.filter((connector) => connector.userConfigured && connector.transport === 'streamableHttp')
  const [showAccountAdd, setShowAccountAdd] = useState(false)
  const [accountConnectorName, setAccountConnectorName] = useState(accountSources[0]?.name ?? '')
  const [accountLabel, setAccountLabel] = useState('')
  const [accountIdentifier, setAccountIdentifier] = useState('')
  const [browserNotice, setBrowserNotice] = useState<string | null>(null)
  const [shortcutAgentId, setShortcutAgentId] = useState(snapshot.agents[0]?.id ?? '')
  const [shortcutName, setShortcutName] = useState(snapshot.shortcuts[0]?.name ?? '')
  const [shortcutInput, setShortcutInput] = useState('Prepare a local draft. Do not send or publish it.')
  const normalizedAppSearch = appSearch.trim().toLocaleLowerCase()
  const visibleConnectedApps = snapshot.connectedApps.filter((app) => normalizedAppSearch
    ? `${app.name} ${app.description}`.toLocaleLowerCase().includes(normalizedAppSearch)
    : app.isAccessible && app.isEnabled)

  async function saveConnector(): Promise<void> {
    const input: ConnectorInput = transport === 'stdio'
      ? { name: connectorName, transport, command: endpoint, args: connectorArgs.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) }
      : { name: connectorName, transport, url: endpoint }
    await onAction(() => editingName ? window.splittbot.connectors.update(editingName, input) : window.splittbot.connectors.add(input))
    setShowAdd(false)
    setEditingName(null)
  }

  function editConnector(name: string): void {
    const connector = snapshot.connectors.find((entry) => entry.name === name)
    if (!connector || !connector.userConfigured || connector.transport === 'runtime') return
    setEditingName(name); setConnectorName(name); setTransport(connector.transport); setEndpoint(connector.endpoint ?? ''); setConnectorArgs(connector.args.join('\n')); setShowAdd(true)
  }

  async function saveConnectorAccount(): Promise<void> {
    await onAction(async () => {
      const result = await window.splittbot.connectors.addAccount({ connectorName: accountConnectorName, label: accountLabel, accountIdentifier: accountIdentifier || null })
      await openConnection(result.authorizationUrl, `${accountLabel.trim()} authentication`)
    })
    setShowAccountAdd(false)
    setAccountLabel('')
    setAccountIdentifier('')
  }

  async function openConnection(url: string, label: string): Promise<void> {
    const result = await window.splittbot.app.openExternal(url)
    setBrowserNotice(`${label} opened in ${result.browserName}. SplittBot stays available; close the browser tab or switch back at any time.`)
  }

  return <Page title="Tools & integrations" eyebrow="Reviewed capabilities" detail="Connect MCP services, review Codex skills, and approve structured Apple Shortcuts without storing API keys.">
    {snapshot.integrationError ? <div className="inline-warning"><CircleAlert size={15} /> {snapshot.integrationError}</div> : null}
    <div className="tab-row"><button className={tab === 'connectors' ? 'active' : ''} onClick={() => setTab('connectors')}>Apps · {snapshot.connectedApps.length}</button><button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>Skills · {snapshot.skills.length}</button><button className={tab === 'shortcuts' ? 'active' : ''} onClick={() => setTab('shortcuts')}>Shortcuts · {snapshot.shortcuts.length}</button></div>
    {tab === 'connectors' ? <>
      <section className="app-catalog-panel panel">
        <div className="panel-heading"><div><span className="eyebrow">Preconfigured connections</span><h3>Choose an app by name</h3><p className="muted-copy">Choose Outlook Email or another familiar app, then finish the provider’s secure browser sign-in. SplittBot never asks for or stores your password.</p></div><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.connectors.refresh())}>Refresh apps</button></div>
        {browserNotice ? <div className="browser-handoff" role="status"><ShieldCheck size={16} /><span><strong>Secure sign-in opened outside SplittBot</strong>{browserNotice}</span><button className="ghost-button" aria-label="Dismiss browser message" onClick={() => setBrowserNotice(null)}><X size={14} /></button></div> : null}
        <div className="app-catalog-search"><input aria-label="Find an app" value={appSearch} onChange={(event) => setAppSearch(event.target.value)} placeholder="Search apps by name…" /><span>{normalizedAppSearch ? `${visibleConnectedApps.length} matches in this catalog page` : `${visibleConnectedApps.length} apps available to your account`}</span></div>
        <div className="app-catalog-grid">{visibleConnectedApps.length ? visibleConnectedApps.map((app) => {
          const grantedAgents = snapshot.agents.filter((agent) => agent.grants.allowedConnectedApps.includes(app.id))
          return <article className="app-catalog-card" key={app.id}>
            <span className={`integration-icon ${app.callable ? 'active' : 'paused'}`}><Plug size={18} /></span>
            <div><h3>{app.name}</h3><p>{app.description}</p><small>{app.callable ? `${app.runtimeName || app.name} is connected and ready in Codex` : app.isAccessible && app.isEnabled ? 'Available, but sign-in or enablement is still required' : 'Not currently available to this ChatGPT account'}</small></div>
            <StatusPill status={app.callable ? 'active' : 'paused'} />
            {app.installUrl ? <button className={app.callable ? 'secondary-button app-connection-action' : 'primary-button app-connection-action'} onClick={() => void onAction(() => openConnection(app.installUrl!, app.name))}>{app.callable ? 'Manage connection' : /outlook/i.test(app.name) ? 'Open Microsoft sign-in' : 'Connect'}</button> : <p className="app-connection-action muted-copy">Manage this connection in ChatGPT. No direct setup link is available.</p>}
            <div className="app-bot-access"><div><strong>Bot access</strong><small>{grantedAgents.length ? `Granted to ${grantedAgents.map((agent) => agent.name).join(', ')}` : 'Connected apps stay unavailable to every Bot until you grant access.'}</small></div><div className="app-bot-grants">{snapshot.agents.map((agent) => {
              const granted = agent.grants.allowedConnectedApps.includes(app.id)
              return <button type="button" key={agent.id} disabled={busy || (!app.callable && !granted)} className={granted ? 'selected' : ''} aria-pressed={granted} aria-label={`${granted ? 'Revoke' : 'Grant'} ${app.name} ${granted ? 'from' : 'to'} ${agent.name}`} onClick={() => void onAction(() => window.splittbot.agents.setConnectedAppGrant(agent.id, app.id, !granted))}><Avatar agent={agent} /> {agent.name}</button>
            })}</div></div>
          </article>
        }) : <Empty icon={<Plug />} title={normalizedAppSearch ? 'No matching apps' : 'No named apps discovered'} detail={normalizedAppSearch ? 'Try another provider or app name.' : 'Refresh after signing in to ChatGPT. Advanced MCP settings remain available below.'} />}</div>
        <div className="outlook-safety-note"><ShieldCheck size={16} /><span><strong>Outlook sign-in is handled by Microsoft.</strong> Enter your email and password only on Microsoft’s sign-in page. SplittBot receives the connected app—not your password.</span></div>
        <div className="advanced-connector-toggle"><div><strong>Need a custom company connector?</strong><span>Endpoint, transport, executable, and isolated OAuth fields are for administrators and MCP developers.</span></div><button className="secondary-button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? 'Hide advanced settings' : 'Advanced MCP settings'}</button></div>
      </section>
      {showAdvanced ? <section className="account-aware-panel panel">
        <div className="panel-heading"><div><span className="eyebrow">Account-aware authentication</span><h3>Separate identities on the same source</h3><p className="muted-copy">Create one isolated OAuth slot per login, then grant the exact identity to each agent. SplittBot stores labels and IDs—not OAuth tokens.</p></div><button className="primary-button" disabled={!accountSources.length} onClick={() => { setAccountConnectorName(accountSources[0]?.name ?? ''); setShowAccountAdd(true) }}><Plus size={14} /> Add account identity</button></div>
        {!accountSources.length ? <div className="inline-warning"><CircleAlert size={15} /> Add a secure HTTP connector before creating account identities.</div> : null}
        {showAccountAdd ? <div className="account-form"><div className="form-grid compact-form"><label><span>Connector source</span><select aria-label="Account connector source" value={accountConnectorName} onChange={(event) => setAccountConnectorName(event.target.value)}>{accountSources.map((connector) => <option value={connector.name} key={connector.name}>{connector.displayName}</option>)}</select></label><label><span>Account label</span><input aria-label="Account label" value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder="Work" /></label><label className="wide"><span>Login identifier · optional</span><input aria-label="Login identifier" value={accountIdentifier} onChange={(event) => setAccountIdentifier(event.target.value)} placeholder="name@company.com" /></label></div><p className="muted-copy">The browser will open after creation. Choose the user that matches this label; a second identity gets a different isolated OAuth slot.</p><div className="inline-form-actions"><button className="secondary-button" onClick={() => setShowAccountAdd(false)}>Cancel</button><button className="primary-button" disabled={busy || !accountConnectorName || !accountLabel.trim()} onClick={() => void saveConnectorAccount()}>Create & authenticate</button></div></div> : null}
        <div className="connector-account-list">{snapshot.connectorAccounts.length ? snapshot.connectorAccounts.map((account) => <article className="connector-account-row" key={account.id}><span className={`integration-icon ${account.enabled ? 'active' : 'paused'}`}><Users size={17} /></span><div><h3>{account.connectorDisplayName} · {account.label}</h3><p>{account.accountIdentifier || 'No login identifier saved'} · {account.authStatus}{account.error ? ` · ${account.error}` : ''}</p><small>Isolated OAuth slot · <span className="integration-technical-name">{account.runtimeName}</span></small></div><StatusPill status={account.authStatus === 'oAuth' ? 'active' : account.error ? 'failed' : 'paused'} /><div className="integration-actions"><button className={account.authStatus === 'oAuth' ? 'secondary-button' : 'primary-button'} disabled={busy} onClick={() => void onAction(async () => { const login = await window.splittbot.connectors.loginAccount(account.id); await openConnection(login.authorizationUrl, `${account.connectorDisplayName} · ${account.label}`) })}>{account.authStatus === 'oAuth' ? 'Reconnect' : 'Connect OAuth'}</button>{account.authStatus === 'oAuth' ? <button className="ghost-button" disabled={busy} onClick={() => { if (window.confirm(`Revoke OAuth for ${account.connectorDisplayName} · ${account.label}?`)) void onAction(() => window.splittbot.connectors.logoutAccount(account.id)) }}>Disconnect</button> : null}<button className="ghost-button danger-text" disabled={busy} onClick={() => { if (window.confirm(`Remove ${account.connectorDisplayName} · ${account.label}? Its agent grants will be removed and any connected OAuth session will be revoked first.`)) void onAction(() => window.splittbot.connectors.removeAccount(account.id)) }}><Trash2 size={13} /> Remove</button></div></article>) : <p className="muted-copy">No account identities yet. Shared connector grants remain available for compatibility, but account identities are the safe choice for multiple users.</p>}</div>
      </section> : null}
    </> : null}
    {tab === 'connectors' && showAdvanced ? <div><div className="page-actions"><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.connectors.refresh())}>Refresh MCP</button><button className="primary-button" onClick={() => { setEditingName(null); setConnectorName(''); setEndpoint(''); setConnectorArgs(''); setShowAdd(true) }}><Plus size={14} /> Add custom MCP connector</button></div>{showAdd ? <section className="inline-form panel"><div className="form-grid compact-form"><label><span>Technical connector ID</span><input aria-label="Connector name" value={connectorName} disabled={Boolean(editingName)} onChange={(event) => setConnectorName(event.target.value)} placeholder="project_docs" /></label><label><span>Connection method</span><select aria-label="Transport" value={transport} onChange={(event) => setTransport(event.target.value as 'streamableHttp' | 'stdio')}><option value="streamableHttp">Secure HTTPS service</option><option value="stdio">Local MCP executable</option></select></label><label className="wide"><span>{transport === 'stdio' ? 'Absolute executable path' : 'HTTPS MCP endpoint'}</span><input aria-label={transport === 'stdio' ? 'Absolute executable path' : 'HTTPS endpoint'} value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={transport === 'stdio' ? '/usr/local/bin/my-mcp-server' : 'https://example.com/mcp'} /></label>{transport === 'stdio' ? <label className="wide"><span>Developer arguments · one per line</span><textarea value={connectorArgs} onChange={(event) => setConnectorArgs(event.target.value)} placeholder={'--mode\nmcp'} /></label> : null}</div><p className="muted-copy">Advanced MCP settings are intended for a connector administrator. Normal Outlook users should use the named Outlook Email card above.</p><div className="inline-form-actions"><button className="secondary-button" onClick={() => { setShowAdd(false); setEditingName(null) }}>Cancel</button><button className="primary-button" disabled={busy || !connectorName || !endpoint} onClick={() => void saveConnector()}>{editingName ? 'Save changes' : 'Save custom connector'}</button></div></section> : null}<div className="integration-list">{snapshot.connectors.length ? snapshot.connectors.map((connector) => <article className="integration-row" key={connector.name}><span className={`integration-icon ${connector.enabled ? 'active' : 'paused'}`}><Plug size={18} /></span><div><h3>{connector.displayName}</h3><p>{connector.error || `${connector.toolCount} tools · ${connector.resourceCount} resources · ${connector.authStatus}${connector.userConfigured ? ` · ${connector.transport}` : ' · runtime-managed'}`}</p><small><span className="integration-technical-name">{connector.name}</span> · {connector.endpoint ?? 'Configuration managed by Codex'}</small></div><StatusPill status={connector.enabled ? (connector.error ? 'failed' : 'active') : 'paused'} /><div className="integration-actions">{connector.authStatus === 'notLoggedIn' ? <button className="primary-button" onClick={() => void onAction(async () => { const login = await window.splittbot.connectors.login(connector.name); await window.splittbot.app.openExternal(login.authorizationUrl) })}>Connect OAuth</button> : null}{connector.authStatus === 'oAuth' ? <><button className="secondary-button" onClick={() => void onAction(async () => { const login = await window.splittbot.connectors.login(connector.name); await window.splittbot.app.openExternal(login.authorizationUrl) })}>Reconnect</button><button className="ghost-button" onClick={() => { if (window.confirm(`Revoke OAuth access for ${connector.displayName}?`)) void onAction(() => window.splittbot.connectors.logout(connector.name)) }}>Disconnect</button></> : null}{connector.canGrant ? <><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.connectors.setEnabled(connector.name, !connector.enabled))}>{connector.enabled ? 'Disable' : 'Enable'}</button><button className="ghost-button" disabled={busy} onClick={() => editConnector(connector.name)}><Pencil size={13} /> Edit</button><button className="ghost-button danger-text" disabled={busy} onClick={() => { if (window.confirm(`Remove ${connector.displayName}? Agent grants will also be removed. Active granted work blocks this action.`)) void onAction(() => window.splittbot.connectors.remove(connector.name)) }}><Trash2 size={13} /> Remove</button></> : <span className="runtime-managed">Managed by Codex</span>}</div></article>) : <Empty icon={<Plug />} title="No custom MCP connectors" detail="Add one only when your organization gives you a secure MCP URL or local server." />}</div></div> : null}
    {tab === 'skills' ? <div className="integration-list">{snapshot.skills.length ? snapshot.skills.map((skill) => <article className="integration-row skill-row" key={skill.path}><span className={`integration-icon ${skill.reviewStatus}`}><Workflow size={18} /></span><div><h3>{skill.displayName}</h3><p>{skill.description}</p><small><span className="integration-technical-name">${skill.name}</span> · {skill.scope} · {skill.dependencies.length ? `${skill.dependencies.length} dependencies` : 'No declared tool dependencies'}</small></div><StatusPill status={skill.reviewStatus} /><div className="integration-actions"><button className="secondary-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.skills.review(skill.path, skill.reviewStatus === 'reviewed' ? 'unreviewed' : 'reviewed'))}>{skill.reviewStatus === 'reviewed' ? 'Reset review' : 'Approve review'}</button><button className="ghost-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.skills.review(skill.path, 'blocked'))}>Block</button><button className="ghost-button" disabled={busy} onClick={() => void onAction(() => window.splittbot.skills.setEnabled(skill.path, !skill.enabled))}>{skill.enabled ? 'Disable' : 'Enable'}</button></div></article>) : <Empty icon={<Workflow />} title="No skills discovered" detail="Refresh after installing a Codex skill." />}</div> : null}
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

function NotificationsView({ snapshot, onAction, onOpenRun, onOpenAgent, onOpenApprovals }: { snapshot: AppSnapshot; onAction: (action: () => Promise<unknown>) => Promise<void>; onOpenRun: (id: string) => void; onOpenAgent: (id: string) => void; onOpenApprovals: () => void }): JSX.Element {
  return <Page title="Notifications" eyebrow="Routine outcomes" detail="Open a notice to review its run, approval, or agent."><div className="page-actions"><button className="secondary-button" disabled={!snapshot.notifications.some((notification) => !notification.read)} onClick={() => void onAction(() => window.splittbot.notifications.markAllRead())}>Mark all read</button></div><div className="notification-list">{snapshot.notifications.length ? snapshot.notifications.map((notification) => {
    const open = notification.type === 'approval' ? onOpenApprovals : notification.runId ? () => onOpenRun(notification.runId!) : snapshot.agents.some((agent) => agent.id === notification.agentId) ? () => onOpenAgent(notification.agentId!) : null
    const destination = notification.type === 'approval' ? 'Review approvals' : notification.runId ? 'View run' : 'Open agent'
    return <article className={`notification-row ${notification.read ? 'read' : ''}`} key={notification.id}><span className="integration-icon"><Bell size={17} /></span><div><strong>{notification.title}</strong><p>{notification.body}</p><small>{formatTime(notification.createdAt)}</small><div className="button-row">{open ? <button className="text-button" onClick={() => void onAction(async () => { if (!notification.read) await window.splittbot.notifications.markRead(notification.id); open() })}>{destination} <ChevronRight size={12} /></button> : null}{!notification.read ? <button className="text-button" onClick={() => void onAction(() => window.splittbot.notifications.markRead(notification.id))}>Mark read</button> : null}</div></div>{notification.read ? null : <i />}</article>
  }) : <Empty icon={<Bell />} title="No notifications" detail="Routine outcomes will appear here." />}</div></Page>
}

function ApprovalsView({ snapshot, filter, onFilter, onAction, onOpenAgent }: { snapshot: AppSnapshot; filter: 'pending' | 'all'; onFilter: (filter: 'pending' | 'all') => void; onAction: (action: () => Promise<unknown>) => Promise<void>; onOpenAgent: () => void }): JSX.Element {
  const approvals = snapshot.approvals.filter((approval) => filter === 'all' || approval.status === 'pending')
  return <Page title="Approvals" eyebrow="Human control" detail="Review what changes, what leaves the Mac, reversibility, and the exact post-approval behavior before continuing."><div className="run-toolbar segmented-control" aria-label="Filter approvals"><button className={filter === 'pending' ? 'active' : ''} aria-pressed={filter === 'pending'} onClick={() => onFilter('pending')}>Pending requests</button><button className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => onFilter('all')}>All requests</button></div><div className="approval-list">{approvals.length ? approvals.map((approval) => <ApprovalCard key={approval.id} approval={approval} agentName={snapshot.agents.find((agent) => agent.id === approval.agentId)?.name || 'Codex'} onAction={onAction} />) : <div className="actionable-empty"><Empty icon={<ShieldCheck />} title="Nothing is waiting" detail="There are no requests needing your approval." /><div className="button-row"><button className="secondary-button" onClick={onOpenAgent}>Open agents</button>{filter === 'pending' && snapshot.approvals.length ? <button className="ghost-button" onClick={() => onFilter('all')}>View approval history</button> : null}</div></div>}</div></Page>
}

function ApprovalCard({ approval, agentName, onAction }: { approval: AppSnapshot['approvals'][number]; agentName: string; onAction: (action: () => Promise<unknown>) => Promise<void> }): JSX.Element {
  const [question, setQuestion] = useState('')
  const [editedInput, setEditedInput] = useState(String(approval.request.input ?? ''))
  const canAsk = Boolean(approval.runId && !approval.method.startsWith('local.'))
  const canEdit = approval.impact.editableFields.includes('input')
  return <article className={`approval-card ${approval.status}`}><div className="approval-mark"><ShieldCheck size={20} /></div><div className="approval-copy"><div className="approval-top"><div><span className="eyebrow">{approvalKind(approval.method)}</span><h3>{approval.title}</h3></div><StatusPill status={approval.status} /></div><p>{approval.summary}</p><div className="approval-impact"><span><small>Target resource</small><strong>{approval.impact.targetResource}</strong></span><span><small>Data leaving this Mac</small><strong>{approval.impact.dataLeavingMac}</strong></span><span><small>Reversibility</small><strong>{approval.impact.reversibility}</strong></span><span><small>After approval</small><strong>{approval.impact.afterApproval}</strong></span></div><details><summary>Inspect exact request</summary><pre>{JSON.stringify(approval.request, null, 2)}</pre></details><div className="approval-meta">Requested {formatTime(approval.createdAt)} · {agentName}</div>{approval.status === 'pending' ? <>{canAsk ? <div className="approval-question"><input aria-label="Ask about approval" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask what this action will do…" /><button className="secondary-button" disabled={!question.trim()} onClick={() => void onAction(async () => { await window.splittbot.approvals.ask(approval.id, question); setQuestion('') })}>Ask without approving</button></div> : null}{canEdit ? <div className="approval-edit"><span className="field-title">Editable exact Shortcut input</span><textarea aria-label="Edited approval input" value={editedInput} onChange={(event) => setEditedInput(event.target.value)} /><button className="secondary-button" onClick={() => void onAction(() => window.splittbot.approvals.editAndApprove(approval.id, editedInput))}><Pencil size={14} /> Edit, revalidate & approve</button></div> : null}<div className="approval-actions"><button className="secondary-button" onClick={() => void onAction(() => window.splittbot.approvals.resolve(approval.id, 'decline'))}><X size={15} /> Decline</button><button className="primary-button" onClick={() => void onAction(() => window.splittbot.approvals.resolve(approval.id, 'approve'))}><Check size={15} /> Approve once</button></div></> : null}</div></article>
}

function ArtifactsView({ snapshot, onOpenRun, onOpenAgent }: { snapshot: AppSnapshot; onOpenRun: (id: string) => void; onOpenAgent: (id: string) => void }): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = snapshot.artifacts.find((artifact) => artifact.id === selectedId)
  const detailRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => { detailRef.current?.scrollIntoView({ block: 'start' }) }, [selectedId])
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  async function exportArtifact(id: string): Promise<void> {
    setExportError(null)
    try {
      const result = await window.splittbot.artifacts.export(id)
      if (result) setExportedPath(result.path)
    } catch (error) {
      setExportError(messageOf(error))
    }
  }
  return <Page title="Artifacts" eyebrow="Saved results" detail="Durable outputs from your agents, kept locally.">{exportedPath ? <div className="inline-success">Exported to {exportedPath}</div> : null}{exportError ? <div className="inline-warning"><CircleAlert size={15} /> {exportError}</div> : null}{selected ? <section className="panel artifact-detail" aria-label="Saved output" ref={detailRef}><div className="panel-heading"><h3>{selected.name}</h3><button className="icon-button" aria-label="Close saved output" onClick={() => setSelectedId(null)}><X size={16} /></button></div><pre className="readable-output">{selected.content}</pre><div className="button-row"><button className="secondary-button" onClick={() => void exportArtifact(selected.id)}>Export output</button>{selected.runId ? <button className="ghost-button" onClick={() => onOpenRun(selected.runId!)}>View source run</button> : null}{snapshot.agents.some((agent) => agent.id === selected.agentId) ? <button className="ghost-button" onClick={() => onOpenAgent(selected.agentId)}>Open agent conversation</button> : null}</div></section> : null}<div className="artifact-grid">{snapshot.artifacts.length ? snapshot.artifacts.map((artifact) => <article className="artifact-card" key={artifact.id}><div className="artifact-icon"><FileText size={20} /></div><span className="eyebrow">{artifact.kind}</span><h3>{artifact.name}</h3><p>{artifact.content.slice(0, 180)}{artifact.content.length > 180 ? '…' : ''}</p><div className="artifact-footer"><span>{snapshot.agents.find((agent) => agent.id === artifact.agentId)?.name || 'Agent'} · {formatTime(artifact.createdAt)}</span><div className="button-row"><button className="secondary-button" aria-label={`Read output: ${artifact.name}`} onClick={() => setSelectedId(artifact.id)}>Read output</button><button className="ghost-button" onClick={() => void exportArtifact(artifact.id)}>Export</button></div></div></article>) : <Empty icon={<FileText />} title="No artifacts saved" detail="Save a useful agent response to keep it here." />}</div></Page>
}

function AuditView({ snapshot }: { snapshot: AppSnapshot }): JSX.Element {
  return <Page title="Audit history" eyebrow="Local accountability" detail="An append-only product record of agent, user, and system events."><div className="timeline">{snapshot.audit.length ? snapshot.audit.map((event) => <div className="timeline-row" key={event.id}><span className={`timeline-icon ${event.actor}`}>{event.actor === 'user' ? 'U' : event.actor === 'agent' ? 'A' : 'S'}</span><div><strong>{event.summary}</strong><span>{event.type} · {formatTime(event.createdAt)}</span></div></div>) : <Empty icon={<History />} title="No audit events" detail="Events will be recorded as you work." />}</div></Page>
}

function SettingsView({ snapshot, importBusy, onSignIn, onSignOut, onRefresh, onOpenImports }: { snapshot: AppSnapshot; importBusy: boolean; onSignIn: () => void; onSignOut: () => Promise<void>; onRefresh: () => void; onOpenImports: () => void }): JSX.Element {
  const [appVersion, setAppVersion] = useState('')
  const [dataBusy, setDataBusy] = useState(false)
  const [dataNotice, setDataNotice] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => { void window.splittbot.app.getVersion().then(setAppVersion) }, [])

  async function dataAction(action: () => Promise<void>): Promise<void> {
    setDataBusy(true)
    setDataNotice(null)
    setDataError(null)
    try { await action() } catch (error) { setDataError(messageOf(error)) } finally { setDataBusy(false) }
  }

  return <Page title="Settings" eyebrow="Local runtime" detail="Your ChatGPT identity and Codex models stay outside the renderer."><div className="settings-grid"><section className="settings-card"><div className="settings-icon"><Bot /></div><div><span className="eyebrow">ChatGPT account</span><h3>{snapshot.account.email || (snapshot.account.state === 'authenticated' ? 'Connected account' : 'Not signed in')}</h3><p>{snapshot.account.state === 'authenticated' ? `${snapshot.account.planType || 'ChatGPT'} plan · Codex-managed authentication` : snapshot.account.error || 'Connect through the browser. SplittBot never asks for an API key.'}</p><div className="button-row">{snapshot.account.state === 'authenticated' ? <button className="secondary-button" onClick={() => void onSignOut()}><LogOut size={15} /> Sign out</button> : <button className="primary-button" onClick={onSignIn}><LogIn size={15} /> Sign in with ChatGPT</button>}<button className="ghost-button" onClick={onRefresh}>Check connection</button></div></div></section><section className="settings-card"><div className="settings-icon"><Upload /></div><div><span className="eyebrow">ChatGPT and Codex imports</span><h3>{snapshot.imports.monitored.filter((source) => source.sourceKind === 'codexThread').length} linked Bot{snapshot.imports.monitored.filter((source) => source.sourceKind === 'codexThread').length === 1 ? '' : 's'} · {snapshot.imports.monitored.filter((source) => source.sourceKind === 'codexAutomation').length} monitored task{snapshot.imports.monitored.filter((source) => source.sourceKind === 'codexAutomation').length === 1 ? '' : 's'}</h3><p>Import is always initiated here. SplittBot will not interrupt startup to ask about existing Codex agents or tasks.</p>{snapshot.imports.error ? <div className="data-error">{snapshot.imports.error}</div> : null}<div className="button-row"><button className="primary-button" disabled={importBusy} onClick={onOpenImports}>{importBusy ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />} {importBusy ? 'Scanning Codex…' : 'Import existing agents & tasks'}{!importBusy && snapshot.imports.candidates.length ? ` (${snapshot.imports.candidates.length})` : ''}</button></div><small>Selected agent tasks become safe SplittBot profiles. Selected schedules are monitored without duplicating their runs.</small></div></section><section className="settings-card"><div className="settings-icon"><Sparkles /></div><div><span className="eyebrow">Available models</span><h3>{snapshot.models.length} models discovered</h3><div className="model-tags">{snapshot.models.slice(0, 8).map((model) => <span key={model.id}>{model.displayName}</span>)}</div></div></section><section className="settings-card acceptance-card"><div className="settings-icon"><ShieldCheck /></div><div><span className="eyebrow">Real-Mac acceptance</span><h3>Evidence, not assumptions</h3><p>These checks retain the latest result from this Mac. A deterministic adapter, opened Settings panel, or started OAuth flow is never shown as a pass.</p><div className="acceptance-list">{snapshot.acceptance.map((check) => <article key={check.key}><StatusPill status={check.status} /><span><strong>{check.label}</strong><small>{check.detail}{check.checkedAt ? ` · ${formatTime(check.checkedAt)}` : ''}</small></span></article>)}</div><div className="button-row"><button className="secondary-button" disabled={dataBusy} onClick={() => void dataAction(async () => { await window.splittbot.acceptance.refreshPermissions(); onRefresh() })}>Check runtime & permissions</button><button className="ghost-button" disabled={dataBusy} onClick={() => void dataAction(async () => { await window.splittbot.acceptance.exerciseWakeCatchUp(); onRefresh() })}>Exercise catch-up path</button></div><small>iMessage acceptance never sends. Real OAuth passes only after a successful disconnect/revoke. A real sleep/wake observation remains distinct from exercising the recovery code path.</small></div></section><section className="settings-card"><div className="settings-icon"><Save /></div><div><span className="eyebrow">Data and recovery</span><h3>Back up your local agent desk</h3><p>Create a private SQLite backup containing agent profiles, conversations, grants, connector account bindings, workspaces, memory notes, routines, approvals, artifacts, acceptance results, and audit history. Restoring preserves the current database as a safety copy and restarts SplittBot.</p>{dataNotice ? <div className="data-notice">{dataNotice}</div> : null}{dataError ? <div className="data-error">{dataError}</div> : null}<div className="button-row data-actions"><button className="primary-button" disabled={dataBusy} onClick={() => void dataAction(async () => { const result = await window.splittbot.data.createBackup(); if (result) setDataNotice(`Backup created: ${result.path}`) })}><Save size={14} /> Create backup</button><button className="secondary-button" disabled={dataBusy} onClick={() => void dataAction(async () => { await window.splittbot.data.restoreBackup() })}><Upload size={14} /> Restore backup</button><button className="ghost-button" disabled={dataBusy} onClick={() => void dataAction(() => window.splittbot.data.revealLocalData())}>Reveal local data</button></div><small>GUI screenshots remain in the local data folder; database backups preserve their recorded paths but do not duplicate the image files.</small></div></section><section className="settings-card"><div className="settings-icon"><ShieldCheck /></div><div><span className="eyebrow">Standalone runtime</span><h3>{snapshot.account.runtimeBundled ? 'Bundled with SplittBot' : snapshot.account.runtimeSource || 'Codex runtime'}</h3><p>SplittBot {appVersion || '…'} · {snapshot.account.runtimeSource || 'Codex runtime'} · App-owned profile: <span className="integration-technical-name">{snapshot.account.runtimeHome || 'default profile'}</span>. The renderer stays isolated behind typed IPC, local SQLite, and secret-redacted logs.</p></div></section></div></Page>
}

function ImportPicker({ catalog, onClose, onImported, onRefreshed }: {
  catalog: AppSnapshot['imports']
  onClose: () => void
  onImported: () => Promise<void>
  onRefreshed: () => void
}): JSX.Element {
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const agentTasks = catalog.candidates.filter((candidate) => candidate.sourceKind === 'codexThread')
  const scheduledTasks = catalog.candidates.filter((candidate) => candidate.sourceKind === 'codexAutomation')

  function toggle(key: string): void {
    setSelected((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key])
  }

  async function refreshCatalog(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await window.splittbot.imports.refresh()
      onRefreshed()
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  async function importSelected(): Promise<void> {
    if (!selected.length) return
    setBusy(true)
    setError(null)
    try {
      await window.splittbot.imports.add(selected)
      await onImported()
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop" role="presentation">
    <div className="modal import-modal" role="dialog" aria-modal="true" aria-label="Import from ChatGPT and Codex">
      <header><div><span className="eyebrow">Signed-in account · local discovery</span><h2>What should SplittBot import?</h2><p>Choose local Codex agent tasks to recreate as Bots and scheduled tasks to monitor. Nothing is imported until you select it.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
      <div className="import-modal-body">
        {error ? <div className="data-error">{error}</div> : null}
        {catalog.error ? <div className="inline-warning"><CircleAlert size={15} /> {catalog.error}</div> : null}
        <ImportGroup title="Agent tasks on this Mac" detail="Each selection becomes a read-only SplittBot Bot linked to the original Codex task." candidates={agentTasks} selected={selected} onToggle={toggle} />
        <ImportGroup title="Existing scheduled tasks" detail="SplittBot monitors these in place. It does not create another schedule or duplicate a run." candidates={scheduledTasks} selected={selected} onToggle={toggle} />
        {!catalog.candidates.length ? <Empty icon={<Check />} title="No new local items found" detail="Everything discovered is already linked, or there are no local Codex tasks to import." /> : null}
        {catalog.monitored.length ? <div className="import-linked-summary"><ShieldCheck size={15} /><span><strong>{catalog.monitored.length} already monitored</strong><small>Source status is refreshed while SplittBot is open.</small></span></div> : null}
        <div className="import-boundary"><CircleAlert size={16} /><div><strong>Cloud-only ChatGPT tasks stay in ChatGPT</strong><p>{catalog.cloudScheduledTasks.detail}</p></div></div>
      </div>
      <footer><button className="ghost-button" disabled={busy} onClick={() => void refreshCatalog()}>{busy ? <LoaderCircle className="spin" size={14} /> : <History size={14} />} Scan again</button><button className="secondary-button" disabled={busy} onClick={onClose}>Not now</button><button className="primary-button" disabled={busy || !selected.length} onClick={() => void importSelected()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} Import & monitor{selected.length ? ` ${selected.length}` : ''}</button></footer>
    </div>
  </div>
}

function ImportGroup({ title, detail, candidates, selected, onToggle }: {
  title: string
  detail: string
  candidates: AppSnapshot['imports']['candidates']
  selected: string[]
  onToggle: (key: string) => void
}): JSX.Element | null {
  if (!candidates.length) return null
  return <section className="import-group"><div><h3>{title}</h3><p>{detail}</p></div><div className="import-source-list">{candidates.map((candidate) => <label className={`import-source ${selected.includes(candidate.key) ? 'selected' : ''}`} key={candidate.key}><input type="checkbox" aria-label={`Import ${candidate.name}`} checked={selected.includes(candidate.key)} onChange={() => onToggle(candidate.key)} /><span className="integration-icon">{candidate.sourceKind === 'codexThread' ? <Bot size={17} /> : <CalendarClock size={17} />}</span><span className="import-source-copy"><strong>{candidate.name}</strong><small>{candidate.summary || 'No preview available.'}</small><span>{candidate.scheduleLabel || candidate.cwd || 'Codex task'} · {statusText(candidate.status)}{candidate.updatedAt ? ` · updated ${formatTime(candidate.updatedAt)}` : ''}</span></span></label>)}</div></section>
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

function AgentEditor({ value, agents, models, connectedApps, connectors, connectorAccounts, skills, shortcuts, routines, fallbackCwd, onClose, onSave, onArchive }: {
  value: Agent | 'new'
  agents: Agent[]
  models: AppSnapshot['models']
  connectedApps: AppSnapshot['connectedApps']
  connectors: AppSnapshot['connectors']
  connectorAccounts: AppSnapshot['connectorAccounts']
  skills: AppSnapshot['skills']
  shortcuts: AppSnapshot['shortcuts']
  routines: AppSnapshot['routines']
  fallbackCwd: string
  onClose: () => void
  onSave: (input: AgentInput, scheduleDraft: AgentScheduleDraft | null) => Promise<void>
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
    grants: { readableRoots: [fallbackCwd], writableRoots: [], allowedCommands: [], allowedApps: [], allowedConnectedApps: [], allowedConnectors: [], allowedConnectorAccounts: [], allowedSkillPaths: [], allowedShortcuts: [], networkAccess: false }
  })
  const [saving, setSaving] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<AgentScheduleForm | null>(null)
  const teammates = agents.filter((agent) => agent.id !== existing?.id)
  const agentRoutines = existing ? routines.filter((routine) => routine.agentId === existing.id) : []
  const defaultModel = models.find((model) => model.isDefault) || models[0]
  const selectedModel = form.model ? models.find((model) => model.id === form.model) : defaultModel
  const efforts = selectedModel?.supportedReasoningEfforts ?? []
  const apps = form.grants.allowedApps.join(', ')
  const commands = form.grants.allowedCommands.join(', ')
  const preview = { name: form.name || 'Agent', color: form.color, avatar: form.avatar }
  const eligibleScheduleSkills = skills.filter((skill) => skill.reviewStatus === 'reviewed' && form.grants.allowedSkillPaths.includes(skill.path))

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

  function toggleGrant(key: 'allowedConnectedApps' | 'allowedConnectors' | 'allowedConnectorAccounts' | 'allowedSkillPaths' | 'allowedShortcuts', value: string): void {
    const values = form.grants[key]
    setForm({ ...form, grants: { ...form.grants, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] } })
  }

  function newSchedule(): void {
    setSchedule({ id: null, title: `${form.name || 'Agent'} scheduled task`, prompt: 'Review the approved sources and complete this task. Do not send, publish, delete, or change permissions without a fresh approval.', scheduleKind: 'daily', intervalMinutes: 60, timeOfDay: '08:00', daysOfWeek: [1, 2, 3, 4, 5], catchUpPolicy: 'runOnce', notifyPolicy: 'always', maxRetries: 1, skillPath: '' })
  }

  function editSchedule(routine: AppSnapshot['routines'][number]): void {
    setSchedule({
      id: routine.id,
      title: routine.title,
      prompt: routine.prompt,
      scheduleKind: routine.schedule.kind,
      intervalMinutes: routine.schedule.kind === 'interval' ? routine.schedule.intervalMinutes : 60,
      timeOfDay: routine.schedule.kind === 'daily' ? routine.schedule.timeOfDay : '08:00',
      daysOfWeek: routine.schedule.kind === 'daily' ? routine.schedule.daysOfWeek : [1, 2, 3, 4, 5],
      catchUpPolicy: routine.catchUpPolicy,
      notifyPolicy: routine.notifyPolicy,
      maxRetries: routine.maxRetries,
      skillPath: routine.skillPath ?? ''
    })
  }

  function scheduleDraft(): AgentScheduleDraft | null {
    if (!schedule) return null
    return {
      id: schedule.id,
      input: {
        title: schedule.title,
        prompt: schedule.prompt,
        schedule: schedule.scheduleKind === 'interval' ? { kind: 'interval', intervalMinutes: schedule.intervalMinutes } : { kind: 'daily', timeOfDay: schedule.timeOfDay, daysOfWeek: schedule.daysOfWeek },
        catchUpPolicy: schedule.catchUpPolicy,
        maxRetries: schedule.maxRetries,
        retryDelayMinutes: 5,
        notifyPolicy: schedule.notifyPolicy,
        skillPath: schedule.skillPath || null
      }
    }
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

        <div className="wide agent-schedule-field">
          <div className="agent-schedule-heading"><div><span className="field-title">Scheduled runs</span><small>Run this Bot automatically while your Mac is awake and SplittBot is open.</small></div><button type="button" className="secondary-button" onClick={newSchedule}><Plus size={13} /> Add schedule</button></div>
          {agentRoutines.length ? <div className="agent-schedule-list">{agentRoutines.map((routine) => <article key={routine.id}><span className={`integration-icon ${routine.status}`}><CalendarClock size={16} /></span><div><strong>{routine.title}</strong><small>{formatSchedule(routine.schedule)} · {routine.status === 'active' ? `next ${formatTime(routine.nextRunAt)}` : 'paused'}</small></div><button type="button" className="ghost-button" onClick={() => editSchedule(routine)}><Pencil size={13} /> Edit</button></article>)}</div> : !schedule ? <p className="muted-copy">No schedules yet. Add a daily or repeating task now; pause, run-now, history, and deletion remain available on the Routines page.</p> : null}
          {schedule ? <div className="agent-schedule-form">
            <div className="form-grid compact-form">
              <label><span>Title</span><input aria-label="Schedule title" value={schedule.title} onChange={(event) => setSchedule({ ...schedule, title: event.target.value })} /></label>
              <label><span>Frequency</span><select aria-label="Schedule type" value={schedule.scheduleKind} onChange={(event) => setSchedule({ ...schedule, scheduleKind: event.target.value as 'daily' | 'interval' })}><option value="daily">At a set time</option><option value="interval">Every few minutes or hours</option></select></label>
              <label className="wide"><span>Task instructions</span><textarea aria-label="Schedule instructions" value={schedule.prompt} onChange={(event) => setSchedule({ ...schedule, prompt: event.target.value })} /></label>
              {schedule.scheduleKind === 'daily' ? <label><span>Local time</span><input aria-label="Schedule time" type="time" value={schedule.timeOfDay} onChange={(event) => setSchedule({ ...schedule, timeOfDay: event.target.value })} /></label> : <label><span>Repeat every · minutes</span><input aria-label="Schedule interval" type="number" min="1" max="43200" value={schedule.intervalMinutes} onChange={(event) => setSchedule({ ...schedule, intervalMinutes: Number(event.target.value) })} /></label>}
              <label><span>If the Mac was asleep</span><select aria-label="Schedule missed run" value={schedule.catchUpPolicy} onChange={(event) => setSchedule({ ...schedule, catchUpPolicy: event.target.value as RoutineInput['catchUpPolicy'] })}><option value="runOnce">Run once after wake</option><option value="skip">Skip and record it</option></select></label>
              {schedule.scheduleKind === 'daily' ? <div className="wide teammate-field"><span className="field-title">Days</span><div className="teammate-tags">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <button type="button" key={day} aria-label={`Schedule ${day}`} className={schedule.daysOfWeek.includes(index) ? 'selected' : ''} onClick={() => setSchedule({ ...schedule, daysOfWeek: schedule.daysOfWeek.includes(index) ? schedule.daysOfWeek.filter((value) => value !== index) : [...schedule.daysOfWeek, index].sort() })}>{day}</button>)}</div></div> : null}
              <label><span>Notify me</span><select aria-label="Schedule notifications" value={schedule.notifyPolicy} onChange={(event) => setSchedule({ ...schedule, notifyPolicy: event.target.value as RoutineInput['notifyPolicy'] })}><option value="always">After every run</option><option value="failure">Only if it fails</option><option value="never">Never</option></select></label>
              <label><span>Automatic retries</span><select aria-label="Schedule retries" value={schedule.maxRetries} onChange={(event) => setSchedule({ ...schedule, maxRetries: Number(event.target.value) })}><option value="0">None</option><option value="1">1 retry</option><option value="2">2 retries</option><option value="3">3 retries</option></select></label>
              <label className="wide"><span>Reviewed skill · optional</span><select aria-label="Schedule skill" value={schedule.skillPath} onChange={(event) => setSchedule({ ...schedule, skillPath: event.target.value })}><option value="">No explicit skill</option>{eligibleScheduleSkills.map((skill) => <option key={skill.path} value={skill.path}>{skill.displayName}</option>)}</select></label>
            </div>
            <div className="agent-schedule-actions"><span>{schedule.id ? 'This updates the selected schedule when you save the Bot.' : 'This schedule is created when you save the Bot.'}</span><button type="button" className="ghost-button" onClick={() => setSchedule(null)}>Cancel schedule changes</button></div>
          </div> : null}
        </div>

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
        <label><span>Approved Mac apps</span><input aria-label="Approved apps" value={apps} onChange={(event) => setForm({ ...form, grants: { ...form.grants, allowedApps: splitList(event.target.value) } })} placeholder="Calendar, Microsoft Word" /></label>
        <label><span>Approved commands</span><input value={commands} onChange={(event) => setForm({ ...form, grants: { ...form.grants, allowedCommands: splitList(event.target.value) } })} placeholder="git status, npm test" /></label>
        <div className="wide teammate-field"><span className="field-title">Connected app grants</span><div className="teammate-tags">{connectedApps.filter((app) => app.callable || form.grants.allowedConnectedApps.includes(app.id)).length ? connectedApps.filter((app) => app.callable || form.grants.allowedConnectedApps.includes(app.id)).map((app) => {
          const granted = form.grants.allowedConnectedApps.includes(app.id)
          return <button type="button" key={app.id} title={app.callable ? app.description : `${app.name} must be reconnected in Tools before it can be granted.`} aria-label={app.name} disabled={!app.callable && !granted} className={granted ? 'selected' : ''} onClick={() => toggleGrant('allowedConnectedApps', app.id)}><Plug size={13} /> {app.name}{app.callable ? '' : ' · reconnect'}</button>
        }) : <small>No connected and callable named apps discovered. Open Tools, connect the app, and refresh.</small>}</div><small>Grant connected apps by name. SplittBot verifies each app is callable, enables it only for this Bot, and explicitly tags it in every run.</small></div>
        <div className="wide teammate-field"><span className="field-title">MCP connector grants</span><div className="teammate-tags">{connectors.filter((connector) => connector.canGrant).length ? connectors.filter((connector) => connector.canGrant).map((connector) => <button type="button" key={connector.name} className={form.grants.allowedConnectors.includes(connector.name) ? 'selected' : ''} onClick={() => toggleGrant('allowedConnectors', connector.name)}><Plug size={13} /> {connector.displayName}</button>) : <small>No grantable connectors configured.</small>}</div><small>Only selected user-configured connectors are enabled in this agent’s Codex thread. Built-in runtime services remain governed by Codex.</small></div>
        <div className="wide teammate-field"><span className="field-title">Connector account grants</span><div className="teammate-tags">{connectorAccounts.length ? connectorAccounts.map((account) => <button type="button" key={account.id} aria-label={`${account.connectorDisplayName} · ${account.label}`} className={form.grants.allowedConnectorAccounts.includes(account.id) ? 'selected' : ''} onClick={() => toggleGrant('allowedConnectorAccounts', account.id)}><Users size={13} /> {account.connectorDisplayName} · {account.label}</button>) : <small>Create account identities in Tools to grant separate logins.</small>}</div><small>Choose the exact authenticated identity. Two agents can use the same connector source while remaining bound to different users.</small></div>
        <div className="wide teammate-field"><span className="field-title">Reviewed skill grants</span><div className="teammate-tags">{skills.filter((skill) => skill.reviewStatus === 'reviewed').length ? skills.filter((skill) => skill.reviewStatus === 'reviewed').map((skill) => <button type="button" key={skill.path} title={`$${skill.name}`} aria-label={skill.displayName} className={form.grants.allowedSkillPaths.includes(skill.path) ? 'selected' : ''} onClick={() => toggleGrant('allowedSkillPaths', skill.path)}><Workflow size={13} /> {skill.displayName}</button>) : <small>Approve skills in Tools before granting them.</small>}</div><small>Explicit $skill tags and scheduled skill runs are rejected unless reviewed and granted here.</small></div>
        <div className="wide teammate-field"><span className="field-title">Apple Shortcut grants</span><div className="teammate-tags">{shortcuts.length ? shortcuts.map((shortcut) => <button type="button" key={shortcut.name} className={form.grants.allowedShortcuts.includes(shortcut.name) ? 'selected' : ''} onClick={() => toggleGrant('allowedShortcuts', shortcut.name)}><Sparkles size={13} /> {shortcut.name}</button>) : <small>No Shortcuts discovered.</small>}</div><small>Every run still requires one fresh approval with the exact input visible.</small></div>
        <label className="check-label wide"><input type="checkbox" checked={form.grants.networkAccess} onChange={(event) => setForm({ ...form, grants: { ...form.grants, networkAccess: event.target.checked } })} /><span>Allow network access for this agent</span></label>
      </div>
      <footer>{onArchive ? <button className="danger-button archive-action" onClick={() => void onArchive()}><Archive size={15} /> Archive agent</button> : null}<button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving || !form.name.trim() || !form.role.trim() || !form.instructions.trim() || Boolean(schedule && (!schedule.title.trim() || !schedule.prompt.trim() || (schedule.scheduleKind === 'daily' && !schedule.daysOfWeek.length) || (schedule.scheduleKind === 'interval' && schedule.intervalMinutes < 1)))} onClick={async () => { setSaving(true); try { await onSave(form, scheduleDraft()) } finally { setSaving(false) } }}>{saving ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} {existing ? 'Save changes' : 'Create agent'}</button></footer>
    </div>
  </div>
}

function Page({ title, eyebrow, detail, children }: { title: string; eyebrow: string; detail: string; children: ReactNode }): JSX.Element { return <div className="page scroll-page"><header className="page-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div></header>{children}</div> }
function Empty({ icon, title, detail }: { icon: JSX.Element; title: string; detail: string }): JSX.Element { return <div className="empty"><span>{icon}</span><strong>{title}</strong><p>{detail}</p></div> }
function StatusPill({ status }: { status: string }): JSX.Element { return <span className={`status-pill ${status}`}>{statusText(status)}</span> }
function RunCompact({ run, agent, onOpen }: { run: Run; agent?: Agent; onOpen: () => void }): JSX.Element {
  return <button type="button" className="run-compact" onClick={onOpen} aria-label={`Open completed run: ${run.input}`}>
    <span className={`status-orb ${run.status}`} />
    <div><strong>{run.input}</strong><span>{agent?.name || 'Agent'} · {formatTime(run.startedAt)}</span></div>
    <ChevronRight size={15} />
  </button>
}

function statusText(status: string): string {
  return ({ queued: 'Queued', running: 'Working', waitingApproval: 'Needs approval', pendingApproval: 'Needs approval', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', pending: 'Waiting', approved: 'Approved', declined: 'Declined', expired: 'Expired', ready: 'Ready', active: 'Active', paused: 'Paused', takeover: 'Takeover', stopped: 'Stopped', granted: 'Granted', denied: 'Denied', notDetermined: 'Not determined', restricted: 'Restricted', unavailable: 'Unavailable', missed: 'Missed', reviewed: 'Reviewed', unreviewed: 'Unreviewed', inbox: 'Inbox', next: 'Next', waiting: 'Waiting', scheduled: 'Scheduled', blocked: 'Blocked', done: 'Done', dismissed: 'Dismissed' } as Record<string, string>)[status] || status
}
function isClosedAction(action: ActionItem): boolean { return action.status === 'done' || action.status === 'dismissed' }
function actionTypeLabel(type: ActionItem['type']): string { return type === 'followUp' ? 'Follow-up' : type[0]!.toLocaleUpperCase() + type.slice(1) }
function actionStatusLabel(status: ActionItem['status']): string { return statusText(status) }
function actionIcon(type: ActionItem['type']): JSX.Element {
  if (type === 'decision') return <CircleAlert size={17} />
  if (type === 'followUp') return <Clock3 size={17} />
  if (type === 'risk') return <TriangleAlert size={17} />
  return <CheckCircle2 size={17} />
}
function manualActionDefaults(content: string): Pick<ActionItemCreateInput, 'title' | 'summary' | 'type' | 'priority'> {
  const summary = content.replace(/\s+/g, ' ').trim().slice(0, 2_000) || 'Review this agent result.'
  const lowered = summary.toLocaleLowerCase()
  const type: ActionItem['type'] = /\b(decide|decision|whether|approve|choose)\b/.test(lowered) ? 'decision' : /\b(waiting|follow[ -]?up|awaiting)\b/.test(lowered) ? 'followUp' : /\b(risk|warning|security|legal|fraud|breach)\b/.test(lowered) ? 'risk' : 'task'
  const priority: ActionItem['priority'] = /\b(urgent|immediately|overdue|breach|fraud|today|final notice)\b/.test(lowered) ? 'urgent' : /\b(security|legal|deadline|invoice|payment|billing|settlement|claim)\b/.test(lowered) || type === 'risk' ? 'high' : 'normal'
  const firstSentence = summary.split(/(?<=[.!?])\s+/)[0]!.replace(/^[-*#\s]+/, '').replace(/[.!]+$/, '').slice(0, 180)
  const title = type === 'decision' && !/^decide\b/i.test(firstSentence) ? `Decide ${/^whether\b/i.test(firstSentence) ? '' : 'whether '}${firstSentence}` : firstSentence
  return { title: title || 'Review agent result', summary, type, priority }
}
function toLocalDateTime(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
function formatTime(value: string): string { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
function formatSchedule(schedule: AppSnapshot['routines'][number]['schedule']): string {
  if (schedule.kind === 'interval') {
    if (schedule.intervalMinutes % 1_440 === 0) return `Every ${schedule.intervalMinutes / 1_440} day${schedule.intervalMinutes === 1_440 ? '' : 's'}`
    if (schedule.intervalMinutes % 60 === 0) return `Every ${schedule.intervalMinutes / 60} hour${schedule.intervalMinutes === 60 ? '' : 's'}`
    return `Every ${schedule.intervalMinutes} minutes`
  }
  const days = schedule.daysOfWeek.length === 7 ? 'every day' : schedule.daysOfWeek.map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')
  const [hour, minute] = schedule.timeOfDay.split(':').map(Number)
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute))
  return `${days} at ${time}`
}
function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function splitList(value: string): string[] { return value.split(',').map((item) => item.trim()).filter(Boolean) }
function formatEffort(value: string): string { return value.split(/[-_]/).map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : '').join(' ') }
function formatBytes(value: number): string { return value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB` }

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
