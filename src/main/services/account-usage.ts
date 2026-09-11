import type {
  AccountUsageBucket,
  AccountUsageCredits,
  AccountUsageStatus,
  AccountUsageWindow
} from '../../shared/contracts'

const GENERIC_UNAVAILABLE_MESSAGE = 'Current Codex usage is unavailable from this runtime.'

export function unavailableAccountUsage(error: string | null = null): AccountUsageStatus {
  return {
    state: 'unavailable',
    buckets: [],
    resetCreditsAvailable: null,
    fetchedAt: null,
    error
  }
}

export function parseAccountUsageResponse(value: unknown, fetchedAt = new Date().toISOString()): AccountUsageStatus {
  if (!isRecord(value)) return unavailableAccountUsage(GENERIC_UNAVAILABLE_MESSAGE)

  const multiBucket = isRecord(value.rateLimitsByLimitId)
    ? Object.entries(value.rateLimitsByLimitId)
        .map(([id, entry]) => parseBucket(entry, id))
        .filter((entry): entry is AccountUsageBucket => Boolean(entry))
    : []
  const legacy = parseBucket(value.rateLimits, 'codex')
  const buckets = (multiBucket.length ? multiBucket : legacy ? [legacy] : [])
    .sort((left, right) => left.id === 'codex' ? -1 : right.id === 'codex' ? 1 : (left.name ?? left.id).localeCompare(right.name ?? right.id))

  if (!buckets.length) return unavailableAccountUsage(GENERIC_UNAVAILABLE_MESSAGE)

  const resetCredits = isRecord(value.rateLimitResetCredits)
    ? integerOrNull(value.rateLimitResetCredits.availableCount, 0)
    : null

  return {
    state: 'available',
    buckets,
    resetCreditsAvailable: resetCredits,
    fetchedAt,
    error: null
  }
}

function parseBucket(value: unknown, fallbackId: string): AccountUsageBucket | null {
  if (!isRecord(value)) return null
  const primary = parseWindow(value.primary)
  const secondary = parseWindow(value.secondary)
  const credits = parseCredits(value.credits)
  if (!primary && !secondary && !credits) return null

  return {
    id: textOrNull(value.limitId) ?? fallbackId,
    name: textOrNull(value.limitName),
    planType: textOrNull(value.planType),
    primary,
    secondary,
    credits,
    limitReachedReason: textOrNull(value.rateLimitReachedType),
    spendControlReached: typeof value.spendControlReached === 'boolean' ? value.spendControlReached : null
  }
}

function parseWindow(value: unknown): AccountUsageWindow | null {
  if (!isRecord(value)) return null
  const usedPercent = integerOrNull(value.usedPercent, 0, 100)
  if (usedPercent === null) return null
  return {
    usedPercent,
    windowDurationMinutes: integerOrNull(value.windowDurationMins, 1),
    resetsAt: integerOrNull(value.resetsAt, 1)
  }
}

function parseCredits(value: unknown): AccountUsageCredits | null {
  if (!isRecord(value) || typeof value.hasCredits !== 'boolean' || typeof value.unlimited !== 'boolean') return null
  return {
    hasCredits: value.hasCredits,
    unlimited: value.unlimited,
    balance: textOrNull(value.balance)
  }
}

function integerOrNull(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(minimum, Math.min(maximum, Math.round(value)))
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
