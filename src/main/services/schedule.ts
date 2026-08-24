import type { RoutineSchedule } from '../../shared/contracts'

export function computeNextRun(schedule: RoutineSchedule, after: Date): Date {
  if (Number.isNaN(after.getTime())) throw new Error('The schedule anchor is invalid.')
  if (schedule.kind === 'interval') {
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
  let next = computeNextRun(schedule, new Date(prior))
  let guard = 0
  while (next.getTime() <= now.getTime() && guard < 10_000) {
    next = computeNextRun(schedule, next)
    guard += 1
  }
  if (guard >= 10_000) throw new Error('Schedule advances too frequently to recover safely.')
  return next
}
