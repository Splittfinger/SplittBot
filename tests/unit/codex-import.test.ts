import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listLocalCodexAutomations, parseLocalCodexAutomation, scheduleLabelFromRrule } from '../../src/main/services/codex-import'

describe('local Codex imports', () => {
  it('parses local automation metadata without executing the task', () => {
    const automation = parseLocalCodexAutomation([
      'version = 1',
      'id = "daily-brief"',
      'name = "Daily imported brief"',
      'prompt = "Prepare a concise brief.\\nDo not send anything."',
      'status = "ACTIVE"',
      'rrule = "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=8;BYMINUTE=30"',
      'target_thread_id = "thr_import_marketing"',
      'updated_at = 1788278400000'
    ].join('\n'))

    expect(automation).toMatchObject({
      id: 'daily-brief', name: 'Daily imported brief', status: 'ACTIVE',
      scheduleLabel: 'Weekly on Mon, Wed, Fri at 8:30 AM', targetThreadId: 'thr_import_marketing'
    })
    expect(automation?.prompt).toContain('Do not send anything.')
  })

  it('discovers automation files and ignores invalid folders', async () => {
    const home = await mkdtemp(join(tmpdir(), 'splittbot-codex-import-'))
    await mkdir(join(home, 'automations', 'valid'), { recursive: true })
    await mkdir(join(home, 'automations', 'invalid'), { recursive: true })
    await writeFile(join(home, 'automations', 'valid', 'automation.toml'), 'id = "valid"\nname = "Morning brief"\nprompt = "Summarize safely."\nrrule = "FREQ=DAILY;BYHOUR=7;BYMINUTE=0"\nstatus = "ACTIVE"\n')
    await writeFile(join(home, 'automations', 'invalid', 'automation.toml'), 'name = "Missing required fields"\n')

    await expect(listLocalCodexAutomations(home)).resolves.toMatchObject([{ id: 'valid', name: 'Morning brief', scheduleLabel: 'Daily at 7:00 AM' }])
  })

  it('keeps unsupported recurrence rules readable', () => {
    expect(scheduleLabelFromRrule('FREQ=MONTHLY;BYMONTHDAY=1')).toBe('FREQ=MONTHLY;BYMONTHDAY=1')
  })
})
