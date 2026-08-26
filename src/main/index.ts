import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { app, BrowserWindow, dialog, Notification, shell } from 'electron'
import { resolveCodexLaunch } from './codex/runtime'
import { CodexAppServerClient } from './codex/client'
import { SqliteStore } from './db/store'
import { registerIpc } from './ipc'
import { CodexService } from './services/codex-service'
import { DeterministicGuiAdapter, GuiAutomationBroker } from './services/gui-automation'
import { JsonLogger } from './services/logger'
import { MacGuiAutomationAdapter } from './services/mac-gui-adapter'
import { restoreSplittBotBackup, validateSplittBotBackup } from './services/data-recovery'

let mainWindow: BrowserWindow | null = null
let service: CodexService | null = null
let store: SqliteStore | null = null
let quitting = false

app.setName('SplittBot')

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
      store?.close()
      try {
        await restoreSplittBotBackup(source, databasePath)
      } finally {
        app.relaunch()
        app.exit(0)
      }
    }
  })
  service.on('event', (event) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('splittbot:event', event)
  })

  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: 'SplittBot',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f2f2f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  void service.start().catch((error) => {
    void logger.write('error', 'codex.start.failed', { message: error instanceof Error ? error.message : String(error) })
    mainWindow?.webContents.send('splittbot:event', { type: 'runtime:warning', message: `Codex could not start: ${error instanceof Error ? error.message : String(error)}` })
  })
}

const singleInstance = process.env.SPLITTBOT_TEST_MODE === '1' || app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(createApplication).catch((error) => {
    dialog.showErrorBox('SplittBot could not start', error instanceof Error ? error.message : String(error))
    app.quit()
  })
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && !mainWindow) void createApplication()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  void service?.stop().finally(() => {
    store?.close()
    app.quit()
  })
})
