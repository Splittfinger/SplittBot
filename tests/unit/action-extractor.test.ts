import { describe, expect, it } from 'vitest'
import { extractActionsFromOutput, inferManualAction, isMalformedCapturedAction, normalizedActionKey } from '../../src/main/services/action-extractor'

describe('Action Center extraction', () => {
  it('captures each explicit unresolved decision from one summary line', () => {
    const actions = extractActionsFromOutput('Decisions still needed: whether the invoice is valid and should be paid, whether recent security activity was authorized, and whether to submit the settlement claim.')
    expect(actions).toHaveLength(3)
    expect(actions.map((action) => action.title)).toEqual([
      'Decide whether the invoice is valid and should be paid',
      'Decide whether recent security activity was authorized',
      'Decide whether to submit the settlement claim'
    ])
    expect(actions.every((action) => action.type === 'decision')).toBe(true)
    expect(actions.every((action) => ['high', 'urgent'].includes(action.priority))).toBe(true)
  })

  it('captures structured bullets but ignores ordinary report prose', () => {
    const actions = extractActionsFromOutput([
      'Mailbox cleanup completed. Twelve messages were archived.',
      '',
      'Next actions:',
      '- Confirm the renewal owner',
      '- Contact the vendor before Friday',
      '',
      'FYI: the newsletter needs no response.'
    ].join('\n'))
    expect(actions.map((action) => action.title)).toEqual(['Confirm the renewal owner', 'Contact the vendor before Friday'])
  })

  it('creates stable keys when only timing words change', () => {
    expect(normalizedActionKey('Decide whether the recent invoice should be paid today')).toBe(normalizedActionKey('Whether the invoice should still be paid'))
  })

  it('classifies a manually selected security decision', () => {
    expect(inferManualAction('Decide whether the unfamiliar security activity was authorized.')).toMatchObject({ type: 'decision', priority: 'high' })
  })

  it('captures detailed mailbox priorities and rejects category totals', () => {
    const actions = extractActionsFromOutput([
      '### Top three actions',
      '',
      '1. **Review the sample vendor invoice.** Confirm the project owner within five days before renewing the test subscription. [Open notice](https://example.com/sample-message)',
      '2. **Review the sample security notice.** Confirm whether the demo workspace access was authorized.',
      '3. **Prepare for tomorrow’s planning meeting.** Complete the sample agenda before the meeting.',
      '',
      '### Today’s totals',
      '',
      '- Urgent today: **1**',
      '- Decision needed: **4**',
      '- Quick reply: **0**',
      '- Delegate/follow up: **4**',
      '- FYI/archive: **33**'
    ].join('\n'))

    expect(actions).toHaveLength(3)
    expect(actions[0]).toMatchObject({
      title: 'Review the sample vendor invoice',
      summary: 'Review the sample vendor invoice. Confirm the project owner within five days before renewing the test subscription. Open notice',
      type: 'task',
      priority: 'high'
    })
    expect(actions[1]?.summary).toContain('Confirm whether the demo workspace access was authorized')
    expect(actions.some((action) => /quick reply|fyi\/archive|delegate\/follow/i.test(action.title))).toBe(false)
    expect(isMalformedCapturedAction('Decide whether Delegate/follow up: **4', 'Delegate/follow up: **4')).toBe(true)
  })
})
