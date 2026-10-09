import { describe, expect, it } from 'vitest'
import { safetyEvents, type SessionSummary } from './index'

const s = (over: Partial<SessionSummary>) => ({ sessionId: 'a', endedAt: '2026-01-01T08:20:00.000Z', safeStopCause: null, pain: 1, degraded: false, ...over }) as SessionSummary

describe('safetyEvents', () => {
  it('lists each condition once per session', () => {
    expect(safetyEvents([s({})])).toEqual([])
    expect(safetyEvents([s({ safeStopCause: 'stop-button', pain: 6 })]).map((e) => e.kind)).toEqual(['stop-pressed', 'high-pain'])
    expect(safetyEvents([s({ safeStopCause: 'lead-off', degraded: true })]).map((e) => e.kind)).toEqual(['device-stop', 'degraded'])
    expect(safetyEvents([s({ pain: 4 }), s({ pain: 3 }), s({ pain: null })]).map((e) => e.kind)).toEqual(['high-pain'])
  })
})
