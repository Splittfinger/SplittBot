import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import type { GuiEvidenceKind, GuiPermissions, GuiSession, GuiSessionInput, GuiSessionStatus, GuiStep } from '../../shared/contracts'

export interface GuiEnvironmentState {
  frontmostApp: string
  modalOpen: boolean
}

export interface GuiAutomationAdapter {
  getPermissions(): Promise<GuiPermissions>
  requestPermission(kind: 'accessibility' | 'screenRecording'): Promise<GuiPermissions>
  openPermissionSettings(kind: 'accessibility' | 'screenRecording'): Promise<void>
  inspect(): Promise<GuiEnvironmentState>
  execute(step: GuiStep, targetApp: string): Promise<void>
  capture(): Promise<Buffer>
  cancelCurrent(): void
}

export interface GuiExecutionHooks {
  onProgress(status: GuiSessionStatus, patch: { currentStep?: number; pauseReason?: string | null; error?: string | null }): Promise<void>
  onEvidence(input: { kind: GuiEvidenceKind; stepIndex: number | null; summary: string; path: string }): Promise<void>
  onRetry(stepIndex: number, attempt: number, error: string): Promise<void>
}

export interface GuiExecutionResult {
  status: 'completed' | 'takeover' | 'stopped' | 'failed'
  error: string | null
}

interface ActiveGuiControl {
  sessionId: string
  targetApp: string
  paused: boolean
  stopReason: 'takeover' | 'emergency' | null
  wake: (() => void) | null
}

class StopSignal extends Error {
  constructor(readonly reason: 'takeover' | 'emergency') {
    super(reason === 'takeover' ? 'The user took over the GUI session.' : 'The emergency stop was activated.')
  }
}

export class GuiAutomationBroker {
  private active: ActiveGuiControl | null = null
  private emergencyStopped = false

  constructor(
    private readonly evidenceRoot: string,
    private readonly adapter: GuiAutomationAdapter
  ) {}

  get activeSessionId(): string | null {
    return this.active?.sessionId ?? null
  }

  get isEmergencyStopped(): boolean {
    return this.emergencyStopped
  }

  setEmergencyStopped(stopped: boolean): void {
    this.emergencyStopped = stopped
    if (stopped && this.active) {
      this.active.stopReason = 'emergency'
      this.adapter.cancelCurrent()
      this.wakeActive()
    }
  }

  getPermissions(): Promise<GuiPermissions> {
    return this.adapter.getPermissions()
  }

  requestPermission(kind: 'accessibility' | 'screenRecording'): Promise<GuiPermissions> {
    return this.adapter.requestPermission(kind)
  }

  openPermissionSettings(kind: 'accessibility' | 'screenRecording'): Promise<void> {
    return this.adapter.openPermissionSettings(kind)
  }

  async evidenceDataUrl(path: string): Promise<string> {
    const root = `${resolve(this.evidenceRoot)}${sep}`
    const candidate = resolve(path)
    if (!candidate.startsWith(root)) throw new Error('The evidence path is outside SplittBot GUI storage.')
    return `data:image/png;base64,${(await readFile(candidate)).toString('base64')}`
  }

  pause(sessionId: string): void {
    const active = this.requireActive(sessionId)
    active.paused = true
  }

  resume(sessionId: string): void {
    const active = this.requireActive(sessionId)
    if (this.emergencyStopped) throw new Error('Reset the emergency stop before resuming GUI control.')
    active.paused = false
    this.wakeActive()
  }

  takeover(sessionId: string): void {
    const active = this.requireActive(sessionId)
    active.stopReason = 'takeover'
    this.adapter.cancelCurrent()
    this.wakeActive()
  }

  emergencyStop(): void {
    this.setEmergencyStopped(true)
  }

  async execute(session: GuiSession, maxRetries: number, hooks: GuiExecutionHooks): Promise<GuiExecutionResult> {
    if (this.emergencyStopped) throw new Error('GUI control is emergency-stopped. Reset it before starting another session.')
    if (this.active) throw new Error(`The GUI lane is already owned by session ${this.active.sessionId}.`)
    if (session.steps[0]?.type !== 'activateApp') throw new Error('A GUI plan must begin by activating its approved target app.')

    this.active = { sessionId: session.id, targetApp: session.targetApp, paused: false, stopReason: null, wake: null }

    try {
      const permissions = await this.adapter.getPermissions()
      if (permissions.accessibility !== 'granted' || permissions.screenRecording !== 'granted') {
        throw new Error('Accessibility and Screen Recording permissions are both required before GUI control can start.')
      }
      await this.waitUntilRunnable()
      await mkdir(join(this.evidenceRoot, session.id), { recursive: true, mode: 0o700 })
      await hooks.onProgress('running', { currentStep: 0, pauseReason: null, error: null })
      for (let index = 0; index < session.steps.length; index += 1) {
        const step = session.steps[index]!
        await this.waitUntilRunnable()
        if (index > 0) await this.waitForSafeContext(session, index, hooks)
        await this.executeStepWithRetry(step, session.targetApp, index, maxRetries, hooks)
        await hooks.onProgress('running', { currentStep: index + 1, pauseReason: null })
        const kind: GuiEvidenceKind = index === 0 ? 'before' : index === session.steps.length - 1 ? 'after' : 'step'
        await this.captureEvidence(session, kind, index, `${stepLabel(step)} completed`, hooks)
      }
      return { status: 'completed', error: null }
    } catch (error) {
      const stopped = error instanceof StopSignal ? error.reason : null
      const status = stopped === 'takeover' ? 'takeover' : stopped === 'emergency' ? 'stopped' : 'failed'
      const message = messageOf(error)
      try {
        await this.captureEvidence(session, stopped ? 'stopped' : 'failure', null, message, hooks)
      } catch {
        // The primary failure remains more useful than a secondary capture error.
      }
      return { status, error: message }
    } finally {
      this.active = null
    }
  }

  private async executeStepWithRetry(step: GuiStep, targetApp: string, index: number, maxRetries: number, hooks: GuiExecutionHooks): Promise<void> {
    const retrySafe = step.type === 'activateApp' || step.type === 'wait'
    const attempts = retrySafe ? maxRetries + 1 : 1
    let lastError: unknown
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await this.waitUntilRunnable()
      try {
        if (step.type === 'wait') await this.interruptibleDelay(step.durationMs)
        else await this.adapter.execute(step, targetApp)
        return
      } catch (error) {
        if (this.active?.stopReason) throw new StopSignal(this.active.stopReason)
        lastError = error
        if (attempt < attempts) await hooks.onRetry(index, attempt + 1, messageOf(error))
      }
    }
    throw lastError
  }

  private async waitForSafeContext(session: GuiSession, stepIndex: number, hooks: GuiExecutionHooks): Promise<void> {
    while (true) {
      await this.waitUntilRunnable()
      const state = await this.adapter.inspect()
      const focusChanged = normalizeAppName(state.frontmostApp) !== normalizeAppName(session.targetApp)
      const reason = focusChanged
        ? `Focus changed to ${state.frontmostApp || 'an unknown app'} before step ${stepIndex + 1}.`
        : state.modalOpen
          ? `An unexpected modal dialog appeared in ${session.targetApp} before step ${stepIndex + 1}.`
          : null
      if (!reason) return
      if (!this.active) throw new Error('The GUI lane was released unexpectedly.')
      this.active.paused = true
      await hooks.onProgress('paused', { pauseReason: `${reason} Resolve it manually, then resume, or choose Take over.` })
      try {
        await this.captureEvidence(session, 'paused', stepIndex, reason, hooks)
      } catch {
        // The pause still protects the user if evidence capture is unavailable.
      }
      await this.waitUntilRunnable()
    }
  }

  private async captureEvidence(session: GuiSession, kind: GuiEvidenceKind, stepIndex: number | null, summary: string, hooks: GuiExecutionHooks): Promise<void> {
    const image = await this.adapter.capture()
    if (!image.length) throw new Error('The screen capture returned no evidence.')
    const safeIndex = stepIndex === null ? 'none' : String(stepIndex)
    const path = join(this.evidenceRoot, session.id, `${Date.now()}-${kind}-${safeIndex}.png`)
    await writeFile(path, image, { mode: 0o600 })
    await hooks.onEvidence({ kind, stepIndex, summary, path })
  }

  private async waitUntilRunnable(): Promise<void> {
    while (this.active?.paused && !this.active.stopReason) {
      await new Promise<void>((resolve) => { if (this.active) this.active.wake = resolve })
    }
    if (!this.active) throw new Error('The GUI lane was released unexpectedly.')
    if (this.active.stopReason) throw new StopSignal(this.active.stopReason)
  }

  private async interruptibleDelay(durationMs: number): Promise<void> {
    const deadline = Date.now() + durationMs
    while (Date.now() < deadline) {
      await this.waitUntilRunnable()
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, deadline - Date.now())))
    }
  }

  private requireActive(sessionId: string): ActiveGuiControl {
    if (!this.active || this.active.sessionId !== sessionId) throw new Error('This session does not own the GUI-control lane.')
    return this.active
  }

  private wakeActive(): void {
    const wake = this.active?.wake
    if (this.active) this.active.wake = null
    wake?.()
  }
}

export class DeterministicGuiAdapter implements GuiAutomationAdapter {
  readonly executed: Array<{ step: GuiStep; targetApp: string }> = []
  frontmostApp = 'SplittBot'
  modalOpen = false
  failuresRemaining = 0

  async getPermissions(): Promise<GuiPermissions> {
    return { accessibility: 'granted', screenRecording: 'granted' }
  }

  requestPermission(): Promise<GuiPermissions> {
    return this.getPermissions()
  }

  async openPermissionSettings(): Promise<void> {}

  async inspect(): Promise<GuiEnvironmentState> {
    return { frontmostApp: this.frontmostApp, modalOpen: this.modalOpen }
  }

  async execute(step: GuiStep, targetApp: string): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1
      throw new Error('Deterministic transient GUI failure.')
    }
    this.executed.push({ step, targetApp })
    if (step.type === 'activateApp') this.frontmostApp = targetApp
  }

  async capture(): Promise<Buffer> {
    return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  }

  cancelCurrent(): void {}
}

export function validateGuiSessionInput(input: GuiSessionInput): void {
  if (!input.targetApp.trim() || input.targetApp.length > 120) throw new Error('Choose one approved target app.')
  if (!input.objective || input.objective.length > 500) throw new Error('Describe the GUI objective in 500 characters or fewer.')
  if (!Number.isInteger(input.maxRetries) || input.maxRetries < 0 || input.maxRetries > 2) throw new Error('GUI retries must be between zero and two.')
  if (!input.steps.length || input.steps.length > 20) throw new Error('A GUI plan must contain between one and 20 steps.')
  if (input.steps[0]?.type !== 'activateApp') throw new Error('A GUI plan must begin by activating its approved target app.')
  if (input.steps.slice(1).some((step) => step.type === 'activateApp')) throw new Error('A GUI plan cannot switch or reactivate apps after it starts.')
  for (const step of input.steps) {
    if (step.type === 'wait' && (!Number.isInteger(step.durationMs) || step.durationMs < 100 || step.durationMs > 10_000)) {
      throw new Error('GUI waits must be between 100 ms and 10 seconds.')
    }
    if (step.type === 'clickElement') {
      const label = step.label.trim()
      if (!label || label.length > 120) throw new Error('Every GUI button needs an exact visible label.')
      if (/\b(send|publish|post|purchase|buy|pay|delete|remove|erase|install|allow|grant|submit|confirm|invite|share|upload|save|sign[ -]?in|log[ -]?in)\b/i.test(label)) {
        throw new Error(`The “${label}” control may commit a consequential action. Take over and complete that action yourself.`)
      }
    }
    if (step.type === 'typeText') {
      if (!step.text || step.text.length > 2_000) throw new Error('Exact GUI text must contain between one and 2,000 characters.')
      if (/[\u0000-\u001f\u007f]/.test(step.text)) throw new Error('Exact GUI text cannot contain control characters.')
    }
  }
}

function normalizeAppName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\.app$/, '')
}

function stepLabel(step: GuiStep): string {
  if (step.type === 'activateApp') return 'Target app activation'
  if (step.type === 'wait') return `${step.durationMs} ms wait`
  if (step.type === 'clickElement') return `Click “${step.label}”`
  if (step.type === 'typeText') return 'Exact text entry'
  return `Key ${step.key}`
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
