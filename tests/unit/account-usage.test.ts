import { describe, expect, it } from 'vitest'
import { parseAccountUsageResponse, unavailableAccountUsage } from '../../src/main/services/account-usage'

describe('account usage parsing', () => {
  it('preserves separate account and model windows with credits', () => {
    const usage = parseAccountUsageResponse({
      rateLimits: {},
      rateLimitsByLimitId: {
        codex: {
          limitId: 'codex',
          planType: 'pro',
          primary: { usedPercent: 8, windowDurationMins: 10_080, resetsAt: 1_788_272_663 },
          secondary: null,
          credits: { hasCredits: false, unlimited: false, balance: '0' },
          rateLimitReachedType: null,
          spendControlReached: false
        },
        codex_spark: {
          limitId: 'codex_spark',
          limitName: 'GPT-5.3-Codex-Spark',
          planType: 'pro',
          primary: { usedPercent: 4, windowDurationMins: 300, resetsAt: 1_787_797_052 },
          secondary: { usedPercent: 1, windowDurationMins: 10_080, resetsAt: 1_788_383_852 },
          credits: null
        }
      },
      rateLimitResetCredits: { availableCount: 1 }
    }, '2026-08-26T20:00:00.000Z')

    expect(usage).toMatchObject({
      state: 'available',
      resetCreditsAvailable: 1,
      fetchedAt: '2026-08-26T20:00:00.000Z',
      buckets: [
        { id: 'codex', planType: 'pro', primary: { usedPercent: 8, windowDurationMinutes: 10_080 }, credits: { balance: '0' } },
        { id: 'codex_spark', name: 'GPT-5.3-Codex-Spark', primary: { usedPercent: 4 }, secondary: { usedPercent: 1 } }
      ]
    })
  })

  it('uses the legacy bucket and clamps unsafe percentages', () => {
    const usage = parseAccountUsageResponse({
      rateLimits: {
        primary: { usedPercent: 140.4, windowDurationMins: 300, resetsAt: null },
        credits: { hasCredits: true, unlimited: false, balance: '2.25' }
      }
    })

    expect(usage.state).toBe('available')
    expect(usage.buckets[0]).toMatchObject({ id: 'codex', primary: { usedPercent: 100 }, credits: { balance: '2.25' } })
  })

  it('returns a safe unavailable state for malformed or unsupported responses', () => {
    expect(parseAccountUsageResponse({ rateLimits: {} })).toEqual(unavailableAccountUsage('Current Codex usage is unavailable from this runtime.'))
    expect(parseAccountUsageResponse(null).state).toBe('unavailable')
  })
})
