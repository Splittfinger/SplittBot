import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SqliteStore } from '../../src/main/db/store'
import { restoreSplittBotBackup, validateSplittBotBackup } from '../../src/main/services/data-recovery'

describe('local data recovery', () => {
  it('creates, validates, and restores a private SplittBot database backup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-recovery-'))
    const activePath = join(directory, 'active.sqlite')
    const backupPath = join(directory, 'backup.sqlite')
    const store = await SqliteStore.open(activePath)
    await store.ensureSeedAgent('/tmp/project')
    await store.createBackup(backupPath)
    store.close()

    const validation = await validateSplittBotBackup(backupPath)
    expect(validation.tables).toContain('agents')
    await writeFile(activePath, 'damaged current data')
    const restored = await restoreSplittBotBackup(backupPath, activePath)

    expect((await readFile(activePath)).subarray(0, 16).toString('utf8')).toBe('SQLite format 3\0')
    expect(await readFile(restored.safetyBackupPath, 'utf8')).toBe('damaged current data')
    const restoredStore = await SqliteStore.open(activePath)
    expect(restoredStore.listAgents()[0]?.name).toBe('Atlas')
    restoredStore.close()
  })

  it('rejects unrelated and active database paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'splittbot-recovery-invalid-'))
    const invalidPath = join(directory, 'invalid.sqlite')
    await writeFile(invalidPath, 'not a database')
    await expect(validateSplittBotBackup(invalidPath)).rejects.toThrow(/invalid size|SQLite/)

    const activePath = join(directory, 'active.sqlite')
    const store = await SqliteStore.open(activePath)
    await store.ensureSeedAgent('/tmp/project')
    store.close()
    await expect(restoreSplittBotBackup(activePath, activePath)).rejects.toThrow('other than the active')
  })
})
