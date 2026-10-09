import { OutcomeRequestSchema } from '@symbiomed/api-client'
import { LIMITS, isPlanExpired, type Plan, type SessionSummary } from '@symbiomed/domain'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * What the Today screen may show. An expired plan carries no plan values at all, so an old plan
 * can never be displayed as the current one.
 */
export type TodayView =
  | { kind: 'none' }
  | { kind: 'expired' }
  | { kind: 'active'; plan: Plan; remainingMs: number; sessionsToday: number; nextFrom: Date | null }

export function todayView(plan: Plan | null, sessions: readonly SessionSummary[], now: Date): TodayView {
  if (!plan) return { kind: 'none' }
  if (isPlanExpired(plan, now)) return { kind: 'expired' }
  const today = sessions.filter((s) => new Date(s.startedAt).toDateString() === now.toDateString())
  const last = today.at(-1)
  const nextFrom = last && today.length < LIMITS.sessionsPerDay ? new Date(Date.parse(last.endedAt) + LIMITS.minGapH * HOUR) : null
  return { kind: 'active', plan, remainingMs: Date.parse(plan.expiresAt) - now.getTime(), sessionsToday: today.length, nextFrom: nextFrom && nextFrom > now ? nextFrom : null }
}

export const hoursMinutes = (ms: number) => ({ hours: Math.floor(ms / HOUR), minutes: Math.floor((ms % HOUR) / 60_000) })

/** The newest session, if the patient has not rated it yet. Older sessions are not offered: a late rating is unreliable. */
export const sessionToRate = (sessions: readonly SessionSummary[]) => {
  const last = sessions.at(-1)
  return last && last.comfort === null && last.pain === null ? last : null
}

/** Same rule as the BFF: comfort 0–3, pain 0–10, whole numbers, note up to 200 characters. */
export const outcomeOk = (o: { sessionId: string; comfort: number | null; pain: number | null; note: string }) =>
  OutcomeRequestSchema.safeParse({ ...o, note: o.note.trim() === '' ? null : o.note }).success

export type Progress = {
  flexion: { latest: number | null; series: number[] }
  engagementPct: number | null
  adherence: { done: number; planned: number }
  week: number | null
}

/**
 * Engagement: mean voluntary activation of the last session as a percentage of the target
 * (definition to confirm, docs/OPEN_QUESTIONS.md item 6). Adherence: sessions in the last 7 days
 * against two a day.
 */
export function progress(sessions: readonly SessionSummary[], aTargetPct: number, now: Date): Progress {
  const last = sessions.at(-1)
  const meanAv = last && last.perContraction.length ? last.perContraction.reduce((a, c) => a + c.aV, 0) / last.perContraction.length : null
  const first = sessions[0]
  return {
    flexion: { latest: last?.flexionMaxDeg ?? null, series: sessions.slice(-28).map((s) => s.flexionMaxDeg) },
    engagementPct: meanAv === null ? null : Math.round((100 * meanAv) / aTargetPct),
    adherence: { done: sessions.filter((s) => now.getTime() - Date.parse(s.startedAt) < 7 * DAY).length, planned: 7 * LIMITS.sessionsPerDay },
    week: first ? Math.min(6, Math.floor((now.getTime() - Date.parse(first.startedAt)) / (7 * DAY)) + 1) : null,
  }
}
