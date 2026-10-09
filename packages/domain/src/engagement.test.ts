import { describe, expect, it } from 'vitest'
import { badges, journey, protectedDays, streak, todayRings, weeklyRecap, type Plan, type SessionSummary } from './index'

let n = 0
const s = (day: string, hour = 8, over: Partial<SessionSummary> = {}): SessionSummary => ({
  sessionId: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  patientId: 'pt-test01', planId: '3f1d5c7e-8a2b-4c6d-9e0f-1a2b3c4d5e6f', planVersion: 1, firmwareVersion: '1.4.0',
  startedAt: `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`, endedAt: `${day}T${String(hour).padStart(2, '0')}:20:00.000Z`,
  mode: 1, degraded: false, contractionsDone: 10, peakDeliveredMa: 20, meanDeliveredMa: 18, perContraction: [],
  fatigueMdfDropPct: 5, flexionMaxDeg: 80, safeStopCause: null, comfort: 2, pain: 1, ...over,
})
const now = new Date('2026-03-10T12:00:00.000Z')

describe('streak (forgiving)', () => {
  it('counts consecutive active days and ignores today without a session yet', () => {
    expect(streak({ sessions: [s('2026-03-07'), s('2026-03-08'), s('2026-03-09')], now })).toEqual({ days: 3, protectedDays: 0 })
  })
  it('a missed day starts a new count (no penalty beyond that)', () => {
    expect(streak({ sessions: [s('2026-03-06'), s('2026-03-08'), s('2026-03-09')], now }).days).toBe(2)
  })
  it('a rest day never breaks it', () => {
    expect(streak({ sessions: [s('2026-03-07'), s('2026-03-09')], restDays: ['2026-03-08'], now })).toEqual({ days: 2, protectedDays: 1 })
  })
  it('a STOP press or device stop day is protected', () => {
    const p = protectedDays({ sessions: [s('2026-03-08', 8, { safeStopCause: 'stop-button' }), s('2026-03-09', 8, { safeStopCause: 'lead-off' })], now })
    expect([...p].sort()).toEqual(['2026-03-08', '2026-03-09'])
  })
  it('a pain 4/10 day is protected', () => {
    expect(protectedDays({ sessions: [s('2026-03-08', 8, { pain: 4 }), s('2026-03-09', 8, { pain: 3 })], now }).has('2026-03-08')).toBe(true)
    expect(protectedDays({ sessions: [s('2026-03-09', 8, { pain: 3 })], now }).has('2026-03-09')).toBe(false)
  })
  it('a day without a valid plan (expired) is protected', () => {
    const plan = { issuedAt: '2026-03-06T07:00:00.000Z', expiresAt: '2026-03-07T19:00:00.000Z' } as Plan
    const plan2 = { issuedAt: '2026-03-09T07:00:00.000Z', expiresAt: '2026-03-10T19:00:00.000Z' } as Plan
    const i = { sessions: [s('2026-03-06'), s('2026-03-07'), s('2026-03-09')], plans: [plan, plan2], now }
    expect(protectedDays(i).has('2026-03-08')).toBe(true)
    expect(streak(i)).toEqual({ days: 3, protectedDays: 1 })
  })
  it('is zero with no data', () => expect(streak({ sessions: [], now })).toEqual({ days: 0, protectedDays: 0 }))
})

describe('today rings', () => {
  it('fills from today’s sessions and the newest rating', () => {
    expect(todayRings({ sessions: [s('2026-03-10', 8), s('2026-03-10', 11, { comfort: null, pain: null })], now })).toEqual({ sessionsDone: 2, sessionsPlanned: 2, rated: false })
    expect(todayRings({ sessions: [s('2026-03-10', 8)], now })).toEqual({ sessionsDone: 1, sessionsPlanned: 2, rated: true })
  })
})

describe('journey', () => {
  it('past weeks have counts, the current week is highlighted, future weeks have no numbers', () => {
    const j = journey({ sessions: [s('2026-03-01'), s('2026-03-01', 15), s('2026-03-09')], now })
    expect(j.map((w) => w.state)).toEqual(['done', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(j[0]).toMatchObject({ sessions: 2, planned: 14, daysActive: 1 })
    expect(j[2]?.sessions).toBeNull()
  })
})

describe('badges (behaviours only)', () => {
  const days = Array.from({ length: 7 }, (_, d) => `2026-03-0${d + 1}`)
  const full = days.flatMap((d) => [s(d, 8), s(d, 15)])
  it('earns first session, full day, 7 days, 10 ratings and full week from data', () => {
    const b = Object.fromEntries(badges({ sessions: full, now }).map((x) => [x.id, x.earned]))
    expect(b).toEqual({ 'first-session': true, 'first-full-day': true, 'seven-days-active': true, 'ten-ratings': true, 'ten-checklists': null, 'full-week': true })
  })
  it('never counts unrated sessions as ratings and never rewards intensity', () => {
    const b = badges({ sessions: [s('2026-03-09', 8, { comfort: null, pain: null, peakDeliveredMa: 50 })], now })
    expect(b.find((x) => x.id === 'ten-ratings')).toMatchObject({ earned: false, count: 0 })
    expect(b.find((x) => x.id === 'first-full-day')?.earned).toBe(false)
  })
  it('the checklist badge is not tracked (no data source)', () => {
    expect(badges({ sessions: full, now }).find((x) => x.id === 'ten-checklists')).toMatchObject({ earned: null, count: null })
  })
})

describe('weekly recap', () => {
  it('summarises the 7 days before today', () => {
    const r = weeklyRecap({ sessions: [s('2026-03-02'), s('2026-03-03', 8, { flexionMaxDeg: 70 }), s('2026-03-09', 8, { flexionMaxDeg: 85 })], now })
    expect(r).toMatchObject({ from: '2026-03-03', to: '2026-03-10', sessions: 2, daysActive: 2, kneeBendChangeDeg: 15 })
  })
  it('has no knee bend change with fewer than two sessions', () => {
    expect(weeklyRecap({ sessions: [s('2026-03-09')], now }).kneeBendChangeDeg).toBeNull()
  })
})
