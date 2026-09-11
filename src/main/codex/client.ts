import { EventEmitter } from 'node:events'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import type { JsonLogger } from '../services/logger'
import type { CodexLaunch } from './runtime'
import packageMetadata from '../../../package.json'

type RpcId = string | number
type JsonObject = Record<string, unknown>
type ServerRequestHandler = (method: string, params: JsonObject, id: RpcId) => Promise<unknown>

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code = -32000,
    readonly data?: unknown
  ) {
    super(message)
  }
}

export class CodexAppServerClient extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null
  private lines: Interface | null = null
  private nextId = 1
  private pending = new Map<RpcId, PendingRequest>()
  private serverRequestHandler: ServerRequestHandler | null = null
  private stopping = false
  private starting: Promise<void> | null = null

  constructor(
    readonly launch: CodexLaunch,
    private readonly logger: JsonLogger,
    private readonly requestTimeoutMs = 45_000
  ) {
    super()
  }

  get running(): boolean {
    return Boolean(this.child && this.child.exitCode === null)
  }

  setServerRequestHandler(handler: ServerRequestHandler): void {
    this.serverRequestHandler = handler
  }

  start(): Promise<void> {
    if (this.starting) return this.starting
    if (this.running) return Promise.resolve()
    const starting = this.initialize().catch(async (error) => {
      await this.stop()
      throw error
    }).finally(() => {
      if (this.starting === starting) this.starting = null
    })
    this.starting = starting
    return starting
  }

  private async initialize(): Promise<void> {
    if (this.running) return
    this.stopping = false
    const args = [...this.launch.argsPrefix, 'app-server', '--listen', 'stdio://']
    this.child = spawn(this.launch.command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(this.launch.home ? { CODEX_HOME: this.launch.home } : {}) }
    })
    this.lines = createInterface({ input: this.child.stdout })
    this.lines.on('line', (line) => this.handleLine(line))
    this.child.stderr.on('data', (chunk: Buffer) => {
      const message = chunk.toString('utf8').trim()
      if (message) void this.logger.write('warn', 'codex.stderr', { message })
    })
    const child = this.child
    child.stdin.on('error', (error) => this.handleExit(child, error))
    child.on('error', (error) => this.handleExit(child, error))
    child.on('exit', (code, signal) => this.handleExit(child, new Error(`Codex App Server exited (${code ?? signal ?? 'unknown'}).`)))

    await this.request('initialize', {
      clientInfo: { name: 'splittbot', title: 'SplittBot', version: packageMetadata.version },
      capabilities: { experimentalApi: true }
    })
    this.notify('initialized', {})
    await this.logger.write('info', 'codex.started', { source: this.launch.source, bundled: Boolean(this.launch.bundled) })
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  async stop(): Promise<void> {
    const child = this.child
    if (!child) return
    this.stopping = true
    this.lines?.close()
    this.lines = null
    this.child = null
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Codex App Server stopped.'))
    }
    this.pending.clear()
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (child.exitCode === null) child.kill('SIGKILL')
          resolve()
        }, 1_500)
        child.once('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })
    }
  }

  request<T = unknown>(method: string, params: JsonObject = {}, timeoutMs = this.requestTimeoutMs): Promise<T> {
    if (!this.running) return Promise.reject(new Error('Codex App Server is not running.'))
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex request timed out: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
      try {
        this.write({ method, id, params })
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error)
      }
    })
  }

  notify(method: string, params: JsonObject = {}): void {
    if (!this.running) throw new Error('Codex App Server is not running.')
    this.write({ method, params })
  }

  private write(message: JsonObject): void {
    const child = this.child
    if (!child || child.stdin.destroyed || !child.stdin.writable) throw new Error('Codex App Server input is closed.')
    child.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
      if (error) this.handleExit(child, error)
    })
  }

  private handleLine(line: string): void {
    let message: JsonObject
    try {
      message = JSON.parse(line) as JsonObject
    } catch {
      void this.logger.write('warn', 'codex.invalid-json', { line })
      return
    }

    const id = message.id as RpcId | undefined
    const method = typeof message.method === 'string' ? message.method : null
    if (id !== undefined && !method) {
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      clearTimeout(pending.timer)
      if (message.error && typeof message.error === 'object') {
        const error = message.error as { code?: number; message?: string; data?: unknown }
        pending.reject(new RpcError(error.message ?? 'Codex request failed.', error.code, error.data))
      } else {
        pending.resolve(message.result)
      }
      return
    }

    if (method && id === undefined) {
      this.emit('notification', method, (message.params ?? {}) as JsonObject)
      return
    }

    if (method && id !== undefined) {
      void this.handleServerRequest(id, method, (message.params ?? {}) as JsonObject)
    }
  }

  private async handleServerRequest(id: RpcId, method: string, params: JsonObject): Promise<void> {
    const child = this.child
    try {
      if (!this.serverRequestHandler) throw new RpcError(`Unsupported server request: ${method}`, -32601)
      const result = await this.serverRequestHandler(method, params, id)
      if (child === this.child && this.running) this.write({ id, result })
    } catch (error) {
      const rpcError = error instanceof RpcError ? error : new RpcError(error instanceof Error ? error.message : String(error))
      if (child === this.child && this.running) {
        try { this.write({ id, error: { code: rpcError.code, message: rpcError.message, data: rpcError.data } }) } catch { /* The transport already closed. */ }
      }
    }
  }

  private handleExit(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (child !== this.child || this.stopping) return
    this.child = null
    this.lines?.close()
    this.lines = null
    if (child.exitCode === null) child.kill('SIGTERM')
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
    this.emit('exit', error)
    void this.logger.write('error', 'codex.exited', { message: error.message })
  }
}
