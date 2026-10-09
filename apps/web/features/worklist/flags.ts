import { LIMITS, type SessionSummary } from '@symbiomed/domain'

// Worklist triage, computed in the browser from the sessions the BFF already returns (no new route).
// Every flag carries a text label: colour never carries it alone.

const HOUR = 3_600_000
const WEEK = 7 * 24 * HOUR
/** Flag a plan that expires within this many hours (UI elevation brief: "plan expiring within 12 h"). */
export const EXPIRING_WITHIN_H = 12

export type FlagId = 'high-pain' | 'stop-press' | 'expiring' | 'expired' | 'no-plan'
export type Flag = { id: FlagId; label: string; tone: 'critical' | 'caution' }
export type Triage = { adherence: { done: number; planned: number }; lastPain: number | null; flags: Flag[]; score: number }

export function triage(sessions: readonly SessionSummary[], plan: { status: 'active' | 'expired'; expiresAt: string } | null, now: Date): Triage {
  const week = sessions.filter((s) => now.getTime() - Date.parse(s.startedAt) < WEEK)
  const flags: Flag[] = []
  const pain = week.filter((s) => s.pain !== null && s.pain >= LIMITS.ai.painThreshold).length
  const stops = week.filter((s) => s.safeStopCause === 'stop-button').length
  if (pain) flags.push({ id: 'high-pain', label: `Pain ${LIMITS.ai.painThreshold}/10 or more (${pain})`, tone: 'critical' })
  if (stops) flags.push({ id: 'stop-press', label: `STOP pressed (${stops})`, tone: 'critical' })
  if (!plan) flags.push({ id: 'no-plan', label: 'No plan', tone: 'caution' })
  else if (plan.status === 'expired') flags.push({ id: 'expired', label: 'Plan expired', tone: 'caution' })
  else if (Date.parse(plan.expiresAt) - now.getTime() < EXPIRING_WITHIN_H * HOUR) flags.push({ id: 'expiring', label: `Plan expires within ${EXPIRING_WITHIN_H} h`, tone: 'caution' })
  const lastRated = [...sessions].reverse().find((s) => s.pain !== null)
  return {
    adherence: { done: week.length, planned: 7 * LIMITS.sessionsPerDay },
    lastPain: lastRated?.pain ?? null,
    flags,
    score: flags.reduce((a, f) => a + (f.tone === 'critical' ? 10 : 3), 0),
  }
}
