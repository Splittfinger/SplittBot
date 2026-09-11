import type { RoutineSchedule } from '../../shared/contracts'

// The final date is inclusive in the same Mac-local time zone as daily runs.
// Invalid persisted bounds fail closed instead of turning into an endless pilot.
export function scheduleHasEnded(schedule: RoutineSchedule, now = new Date()): boolean {
  if (!schedule.stopAfterDate) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(schedule.stopAfterDate)) return true
  const end = new Date(`${schedule.stopAfterDate}T00:00:00`)
  if (!Number.isFinite(end.getTime()) || !Number.isFinite(now.getTime())) return true
  const normalized = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  if (normalized !== schedule.stopAfterDate) return true
  end.setDate(end.getDate() + 1)
  return now >= end
}

export function computeNextRun(schedule: RoutineSchedule, after: Date): Date {
  if (Number.isNaN(after.getTime())) throw new Error('The schedule anchor is invalid.')
  if (schedule.kind === 'interval') {
    if (!Number.isInteger(schedule.intervalMinutes) || schedule.intervalMinutes < 1) throw new Error('The interval must be a positive number of minutes.')
    return new Date(after.getTime() + schedule.intervalMinutes * 60_000)
  }

  const [hour, minute] = schedule.timeOfDay.split(':').map(Number)
  const allowedDays = new Set(schedule.daysOfWeek.length ? schedule.daysOfWeek : [0, 1, 2, 3, 4, 5, 6])
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(after)
    candidate.setDate(after.getDate() + offset)
    candidate.setHours(hour!, minute!, 0, 0)
    if (candidate.getTime() > after.getTime() && allowedDays.has(candidate.getDay())) return candidate
  }
  throw new Error('Could not calculate the next daily run.')
}

export function nextAfterNow(schedule: RoutineSchedule, prior: string, now: Date): Date {
  const anchor = new Date(prior)
  const firstNext = computeNextRun(schedule, anchor)
  if (!Number.isFinite(now.getTime())) throw new Error('The recovery time is invalid.')
  if (firstNext > now) return firstNext
  if (schedule.kind === 'interval') {
    const intervalMs = schedule.intervalMinutes * 60_000
    return new Date(anchor.getTime() + (Math.floor((now.getTime() - anchor.getTime()) / intervalMs) + 1) * intervalMs)
  }
  return computeNextRun(schedule, now)
}
