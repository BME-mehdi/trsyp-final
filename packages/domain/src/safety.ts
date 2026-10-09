import { LIMITS } from './limits'
import type { SafeStopCause, SessionSummary } from './session'

export type SafetyEventKind = 'stop-pressed' | 'device-stop' | 'high-pain' | 'degraded'
export type SafetyEvent = { sessionId: string; at: string; kind: SafetyEventKind; cause: SafeStopCause | null; pain: number | null }

/**
 * Events a clinician must see, one per condition per session: a STOP press (counted as pain-related,
 * see OPEN_QUESTIONS.md), any other brace stop, pain >= 4/10, and a session that fell back to Mode 0.
 */
export function safetyEvents(sessions: readonly SessionSummary[]): SafetyEvent[] {
  return sessions.flatMap((s) => {
    const base = { sessionId: s.sessionId, at: s.endedAt, cause: s.safeStopCause, pain: s.pain }
    return [
      ...(s.safeStopCause === 'stop-button' ? [{ ...base, kind: 'stop-pressed' as const }] : []),
      ...(s.safeStopCause !== null && s.safeStopCause !== 'stop-button' ? [{ ...base, kind: 'device-stop' as const }] : []),
      ...(s.pain !== null && s.pain >= LIMITS.ai.painThreshold ? [{ ...base, kind: 'high-pain' as const }] : []),
      ...(s.degraded ? [{ ...base, kind: 'degraded' as const }] : []),
    ]
  })
}
