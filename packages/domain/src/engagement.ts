import { LIMITS } from './limits'
import type { Plan } from './plan'
import type { SessionSummary } from './session'

// Motivation state for the patient app (.claude/skills/rehab-gamification/SKILL.md).
// Pure functions over session summaries and plans: every number comes from data, nothing is estimated.
// Rewards count behaviours (showing up, rating, full days). They never look at mA, pain tolerated or extra sessions.

const DAY = 86_400_000
/** Program length in weeks (spec: six weeks after surgery; the patient app already caps the week at 6). */
export const PROGRAM_WEEKS = 6

export type EngagementInput = {
  sessions: readonly SessionSummary[]
  plans?: readonly Plan[]
  /** Day keys (YYYY-MM-DD) the patient asked to rest. */
  restDays?: readonly string[]
  now: Date
  /** Minutes east of UTC for local day boundaries (mobile passes -getTimezoneOffset()). */
  offsetMin?: number
}

export const dayKey = (t: string | number | Date, offsetMin = 0) => new Date(new Date(t).getTime() + offsetMin * 60_000).toISOString().slice(0, 10)
export const addDays = (key: string, n: number) => new Date(Date.parse(key) + n * DAY).toISOString().slice(0, 10)

const isRated = (s: SessionSummary) => s.comfort !== null || s.pain !== null
const isHighPain = (s: SessionSummary) => s.pain !== null && s.pain >= LIMITS.ai.painThreshold
const sorted = (sessions: readonly SessionSummary[]) => [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))

/** Days with at least one session record. A session that ended with a stop still counts: the patient showed up. */
export function activeDays(i: EngagementInput): Set<string> {
  return new Set(i.sessions.map((s) => dayKey(s.startedAt, i.offsetMin)))
}

/**
 * Days that never break a streak: a brace stop (STOP press or device stop), pain >= threshold,
 * a rest-day request, or no valid plan at any time that day (expired or missing plan).
 */
export function protectedDays(i: EngagementInput): Set<string> {
  const out = new Set<string>(i.restDays ?? [])
  for (const s of i.sessions) if (s.safeStopCause !== null || isHighPain(s)) out.add(dayKey(s.startedAt, i.offsetMin))
  if (i.plans) {
    const first = i.sessions.length ? dayKey(sorted(i.sessions)[0]!.startedAt, i.offsetMin) : null
    const today = dayKey(i.now, i.offsetMin)
    for (let k = first; k !== null && k <= today; k = addDays(k, 1)) {
      const start = Date.parse(k) - (i.offsetMin ?? 0) * 60_000
      const valid = i.plans.some((p) => Date.parse(p.issuedAt) < start + DAY && Date.parse(p.expiresAt) > start)
      if (!valid) out.add(k)
    }
  }
  return out
}

export type Streak = { days: number; protectedDays: number }

/**
 * Consecutive active days up to today. Today without a session yet never breaks it; protected days
 * keep it going without adding to it. A missed day simply starts a new count: the UI shows no loss message.
 */
export function streak(i: EngagementInput): Streak {
  const active = activeDays(i)
  const prot = protectedDays(i)
  const first = i.sessions.length ? dayKey(sorted(i.sessions)[0]!.startedAt, i.offsetMin) : null
  let k = dayKey(i.now, i.offsetMin)
  if (!active.has(k)) k = addDays(k, -1)
  let days = 0
  let protectedCount = 0
  for (; first !== null && k >= first; k = addDays(k, -1)) {
    if (active.has(k)) days++
    else if (prot.has(k)) protectedCount++
    else break
  }
  return { days, protectedDays: protectedCount }
}

export type TodayRings = { sessionsDone: number; sessionsPlanned: number; rated: boolean }

/** Today's rings: session 1, session 2, and whether the newest session of today has a rating. */
export function todayRings(i: EngagementInput): TodayRings {
  const today = dayKey(i.now, i.offsetMin)
  const todays = sorted(i.sessions).filter((s) => dayKey(s.startedAt, i.offsetMin) === today)
  const last = todays.at(-1)
  return { sessionsDone: Math.min(todays.length, LIMITS.sessionsPerDay), sessionsPlanned: LIMITS.sessionsPerDay, rated: !!last && isRated(last) }
}

export type JourneyWeek = { week: number; state: 'done' | 'current' | 'upcoming'; sessions: number | null; planned: number; daysActive: number | null }

/** Program week (1-based) of a day, counted from the day of the first session. Null before any session. */
export function programWeek(i: EngagementInput): number | null {
  const s = sorted(i.sessions)[0]
  if (!s) return null
  const start = Date.parse(dayKey(s.startedAt, i.offsetMin))
  return Math.min(PROGRAM_WEEKS, Math.floor((Date.parse(dayKey(i.now, i.offsetMin)) - start) / (7 * DAY)) + 1)
}

/** Six week-stations. Upcoming weeks carry no numbers. Milestones stay generic ("Week 2 complete"). */
export function journey(i: EngagementInput): JourneyWeek[] {
  const s0 = sorted(i.sessions)[0]
  const current = programWeek(i)
  const startKey = s0 ? dayKey(s0.startedAt, i.offsetMin) : null
  return Array.from({ length: PROGRAM_WEEKS }, (_, n) => {
    const week = n + 1
    const state = current === null || week > current ? 'upcoming' : week === current ? 'current' : 'done'
    if (state === 'upcoming' || startKey === null) return { week, state, sessions: null, planned: 7 * LIMITS.sessionsPerDay, daysActive: null }
    const from = addDays(startKey, 7 * n), to = addDays(startKey, 7 * week)
    const inWeek = i.sessions.filter((s) => { const k = dayKey(s.startedAt, i.offsetMin); return k >= from && k < to })
    return { week, state, sessions: inWeek.length, planned: 7 * LIMITS.sessionsPerDay, daysActive: new Set(inWeek.map((s) => dayKey(s.startedAt, i.offsetMin))).size }
  })
}
