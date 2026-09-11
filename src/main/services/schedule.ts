import type { RoutineSchedule } from '../../shared/contracts'

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
