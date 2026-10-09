import { LIMITS } from './limits'
import { addDays, dayKey, journey, type EngagementInput } from './engagement'
import type { SessionSummary } from './session'

// Badges reward behaviours only (rehab-gamification skill): showing up, full days, ratings, full weeks.
// Never intensity, current, pain, extra sessions or skipped rest. Thresholds: docs/OPEN_QUESTIONS.md item 41.

export const BADGE_IDS = ['first-session', 'first-full-day', 'seven-days-active', 'ten-ratings', 'ten-checklists', 'full-week'] as const
export type BadgeId = (typeof BADGE_IDS)[number]
/** earned: null = not tracked yet (no data source), shown as such, never guessed. */
export type Badge = { id: BadgeId; earned: boolean | null; earnedAt: string | null; count: number | null; target: number }

const byTime = (sessions: readonly SessionSummary[]) => [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))

/** When the n-th item of a chronological list happened, or null. */
const nth = (times: string[], n: number) => (times.length >= n ? times[n - 1]! : null)

export function badges(i: EngagementInput): Badge[] {
  const s = byTime(i.sessions)
  const off = i.offsetMin
  const make = (id: BadgeId, count: number, target: number, at: string | null): Badge => ({ id, earned: at !== null, earnedAt: at, count, target })

  // First day that reached the plan's sessions per day, and the 7th distinct active day.
  const perDay = new Map<string, SessionSummary[]>()
  for (const x of s) perDay.set(dayKey(x.startedAt, off), [...(perDay.get(dayKey(x.startedAt, off)) ?? []), x])
  const fullDay = [...perDay.values()].find((d) => d.length >= LIMITS.sessionsPerDay)
  const firstOfDay = [...perDay.values()].map((d) => d[0]!.startedAt)
  const rated = s.filter((x) => x.comfort !== null || x.pain !== null).map((x) => x.startedAt)

  // A full week: every planned session of a finished program week.
  const weeks = journey(i)
  const firstKey = s[0] ? dayKey(s[0].startedAt, off) : null
  const full = weeks.find((w) => w.state === 'done' && w.sessions !== null && w.sessions >= w.planned)
  const fullAt = full && firstKey ? s.filter((x) => dayKey(x.startedAt, off) < addDays(firstKey, 7 * full.week)).at(-1)?.startedAt ?? null : null
  const bestWeek = Math.max(0, ...weeks.map((w) => (w.state === 'done' ? (w.sessions ?? 0) : 0)))

  return [
    make('first-session', s.length, 1, nth(s.map((x) => x.startedAt), 1)),
    make('first-full-day', Math.max(0, ...[...perDay.values()].map((d) => d.length)), LIMITS.sessionsPerDay, fullDay?.[LIMITS.sessionsPerDay - 1]?.startedAt ?? null),
    make('seven-days-active', perDay.size, 7, nth(firstOfDay, 7)),
    make('ten-ratings', rated.length, 10, nth(rated, 10)),
    // Checklist completions are not recorded in session data yet: not tracked, never guessed.
    { id: 'ten-checklists', earned: null, earnedAt: null, count: null, target: 10 },
    make('full-week', bestWeek, 7 * LIMITS.sessionsPerDay, fullAt),
  ]
}

export type Recap = { from: string; to: string; sessions: number; daysActive: number; badgesEarned: BadgeId[]; kneeBendChangeDeg: number | null }

/** The 7 days before today: counts, badges earned in that span, and knee bend change (null with fewer than 2 sessions). */
export function weeklyRecap(i: EngagementInput): Recap {
  const to = dayKey(i.now, i.offsetMin)
  const from = addDays(to, -7)
  const inRange = (t: string) => { const k = dayKey(t, i.offsetMin); return k >= from && k < to }
  const s = byTime(i.sessions).filter((x) => inRange(x.startedAt))
  const first = s[0], last = s.at(-1)
  return {
    from, to,
    sessions: s.length,
    daysActive: new Set(s.map((x) => dayKey(x.startedAt, i.offsetMin))).size,
    badgesEarned: badges(i).filter((b) => b.earnedAt !== null && inRange(b.earnedAt)).map((b) => b.id),
    kneeBendChangeDeg: first && last && s.length >= 2 ? Math.round(last.flexionMaxDeg - first.flexionMaxDeg) : null,
  }
}
