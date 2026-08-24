import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { chmod, copyFile, mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import initSqlJs from 'sql.js'

const require = createRequire(import.meta.url)
const REQUIRED_TABLES = ['agents', 'messages', 'runs', 'approvals', 'artifacts', 'audit_events', 'app_state']
const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024

export interface BackupValidation {
  size: number
  tables: string[]
}

export async function validateSplittBotBackup(path: string): Promise<BackupValidation> {
  const metadata = await stat(path)
  if (!metadata.isFile()) throw new Error('Choose a SplittBot SQLite backup file.')
  if (metadata.size < 100 || metadata.size > MAX_BACKUP_BYTES) throw new Error('The selected backup has an invalid size.')

  const bytes = await readFile(path)
  if (bytes.subarray(0, 16).toString('utf8') !== 'SQLite format 3\0') throw new Error('The selected file is not a SQLite database.')

  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
  const database = new SQL.Database(bytes)
  try {
    const integrity = database.exec('PRAGMA integrity_check')
    if (String(integrity[0]?.values[0]?.[0] ?? '') !== 'ok') throw new Error('The selected database did not pass its integrity check.')
    const result = database.exec("SELECT name FROM sqlite_master WHERE type = 'table'")
    const tables = (result[0]?.values ?? []).map((row) => String(row[0]))
    const missing = REQUIRED_TABLES.filter((table) => !tables.includes(table))
    if (missing.length) throw new Error(`The selected database is not a compatible SplittBot backup. Missing: ${missing.join(', ')}.`)
    return { size: metadata.size, tables }
  } finally {
    database.close()
  }
}

export async function restoreSplittBotBackup(sourcePath: string, databasePath: string): Promise<{ safetyBackupPath: string }> {
  const source = await realpath(resolve(sourcePath))
  const destination = await realpath(resolve(databasePath))
  if (source === destination) throw new Error('Choose a backup file other than the active SplittBot database.')
  await validateSplittBotBackup(source)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safetyBackupPath = `${destination}.before-restore-${timestamp}`
  await copyFile(destination, safetyBackupPath)
  await chmod(safetyBackupPath, 0o600)

  const temporaryPath = `${destination}.restore-${randomUUID()}`
  await mkdir(dirname(destination), { recursive: true })
  try {
    await copyFile(source, temporaryPath)
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, destination)
  } catch (error) {
    await copyFile(safetyBackupPath, destination)
    await chmod(destination, 0o600)
    throw error
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return { safetyBackupPath }
}

export async function writePrivateFile(path: string, bytes: Uint8Array): Promise<string> {
  const destination = resolve(path)
  await mkdir(dirname(destination), { recursive: true })
  const temporaryPath = `${destination}.next-${randomUUID()}`
  try {
    await writeFile(temporaryPath, bytes, { mode: 0o600 })
    await rename(temporaryPath, destination)
    await chmod(destination, 0o600)
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return destination
}
