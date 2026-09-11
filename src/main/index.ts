import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { app, BrowserWindow, dialog, nativeTheme, Notification, powerMonitor, shell } from 'electron'
import { resolveCodexLaunch } from './codex/runtime'
import { CodexAppServerClient } from './codex/client'
import { SqliteStore } from './db/store'
import { registerIpc } from './ipc'
import { CodexService } from './services/codex-service'
import { DeterministicGuiAdapter, GuiAutomationBroker } from './services/gui-automation'
import { JsonLogger } from './services/logger'
import { MacGuiAutomationAdapter } from './services/mac-gui-adapter'
import { restoreSplittBotBackup, validateSplittBotBackup } from './services/data-recovery'
import { openHttpsInBrowser, type BrowserOpenResult } from './services/external-browser'

let mainWindow: BrowserWindow | null = null
let service: CodexService | null = null
let store: SqliteStore | null = null
let quitting = false
let reopenWindow: (() => Promise<void>) | null = null

app.setName('SplittBot')
if (process.env.SPLITTBOT_TEST_MODE === '1' && process.env.SPLITTBOT_DATA_DIR) {
  // Keep Chromium caches, cookies, and process rendezvous state isolated too—not
  // only SplittBot's SQLite data. This prevents packaged acceptance runs from
  // colliding with a real SplittBot window that is already open on the Mac.
  app.setPath('userData', process.env.SPLITTBOT_DATA_DIR)
}

async function createApplication(): Promise<void> {
  const dataDirectory = process.env.SPLITTBOT_DATA_DIR || app.getPath('userData')
  const databasePath = process.env.SPLITTBOT_DATABASE_PATH || join(dataDirectory, 'splittbot.sqlite')
  const logger = new JsonLogger(join(dataDirectory, 'logs', 'splittbot.jsonl'))
  store = await SqliteStore.open(databasePath)
  await store.ensureSeedAgent(process.env.SPLITTBOT_DEFAULT_CWD || process.cwd())

  const launch = resolveCodexLaunch(process.resourcesPath, join(dataDirectory, 'codex-profile'))
  if (launch.home) await mkdir(launch.home, { recursive: true, mode: 0o700 })
  const client = new CodexAppServerClient(launch, logger)
  const guiAdapter = process.env.SPLITTBOT_TEST_MODE === '1' ? new DeterministicGuiAdapter() : new MacGuiAutomationAdapter()
  const gui = new GuiAutomationBroker(join(dataDirectory, 'gui-evidence'), guiAdapter)
  const openExternal = async (url: string): Promise<BrowserOpenResult> => {
    if (process.env.SPLITTBOT_TEST_MODE === '1') return { browserName: 'your browser', forcedBrowser: true }
    return openHttpsInBrowser(url, { fallback: (fallbackUrl) => shell.openExternal(fallbackUrl) })
  }
  service = new CodexService(store, client, logger, gui, (title, body) => {
    if (process.env.SPLITTBOT_TEST_MODE !== '1' && Notification.isSupported()) new Notification({ title, body }).show()
  })
  registerIpc(service, {
    dataDirectory,
    defaultBackupDirectory: app.getPath('documents'),
    createBackup: async (destination) => {
      if (!store) throw new Error('SplittBot data is not available.')
      await store.addAudit({ type: 'data.backup.created', actor: 'user', agentId: null, runId: null, summary: 'Created a local database backup', detail: {} })
      return store.createBackup(destination)
    },
    restoreBackup: async (source) => {
      await validateSplittBotBackup(source)
      await service?.stop()
      await store?.flush()
      store?.close()
      try {
        await restoreSplittBotBackup(source, databasePath)
      } finally {
        app.relaunch()
        app.exit(0)
      }
    },
    openExternal
  })
  service.on('event', (event) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('splittbot:event', event)
  })

  // Only native suspend/resume events count as a real cycle. Timer gaps and
  // deterministic test adapters cannot satisfy this acceptance check.
  if (process.env.SPLITTBOT_TEST_MODE !== '1') {
    let suspendedAt: number | null = null
    powerMonitor.on('suspend', () => { suspendedAt = Date.now() })
    powerMonitor.on('resume', () => {
      const start = suspendedAt
      suspendedAt = null
      if (start === null || quitting) return
      void service?.observeNativeWake(start, Date.now()).catch((error) => {
        void logger.write('error', 'system.wake.failed', { message: String(error) })
      })
    })
  }

  reopenWindow = () => createWindow(logger, openExternal)
  await reopenWindow()
  void service.start().catch((error) => {
    void logger.write('error', 'codex.start.failed', { message: error instanceof Error ? error.message : String(error) })
    mainWindow?.webContents.send('splittbot:event', { type: 'runtime:warning', message: `Codex could not start: ${error instanceof Error ? error.message : String(error)}` })
  })
}

async function createWindow(logger: JsonLogger, openExternal: (url: string) => Promise<BrowserOpenResult>): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: 'SplittBot',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#00000000',
    vibrancy: 'under-window',
    visualEffectState: 'followWindow',
    trafficLightPosition: { x: 22, y: 22 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  const window = mainWindow
  const updateMaterial = (): void => {
    if (window.isDestroyed()) return
    const solid = nativeTheme.prefersReducedTransparency || nativeTheme.shouldUseHighContrastColors
    window.setVibrancy(solid ? null : 'under-window')
    window.setBackgroundColor(solid ? (nativeTheme.shouldUseDarkColors ? '#171b23' : '#edf1f7') : '#00000000')
  }
  updateMaterial()
  nativeTheme.on('updated', updateMaterial)
  window.once('closed', () => nativeTheme.off('updated', updateMaterial))

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void openExternal(url).catch((error) => {
      void logger.write('error', 'browser.open.failed', { message: error instanceof Error ? error.message : String(error) })
    })
    return { action: 'deny' }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showApplication(): void {
  if (quitting) return
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  } else {
    void reopenWindow?.().catch((error) => dialog.showErrorBox('SplittBot could not open', String(error)))
  }
}

const singleInstance = process.env.SPLITTBOT_TEST_MODE === '1' || app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', showApplication)

  app.whenReady().then(createApplication).catch((error) => {
    dialog.showErrorBox('SplittBot could not start', error instanceof Error ? error.message : String(error))
    app.quit()
  })
}

app.on('activate', showApplication)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void (async () => {
    await service?.stop()
    await store?.flush()
  })().catch((error) => {
    console.error('SplittBot shutdown:', error instanceof Error ? error.message : String(error))
  }).finally(() => {
    store?.close()
    app.quit()
  })
})
