import {
  AiSuggestionSchema,
  BraceSchema,
  LIMITS,
  ParameterDecisionSchema,
  SessionSummarySchema,
  isPlanExpired,
  nextVersionOk,
  referenceMvcUpdateOk,
  validatePlan,
  type Plan,
} from '@symbiomed/domain'
import { describe, expect, it } from 'vitest'
import { FIXTURE_NOW, PROFILES, braces, decisions, generatePatient, patients, plans, sessions, suggestions } from './index'

const HOUR = 3_600_000
const now = new Date(FIXTURE_NOW)
const byPatient = <T extends { patientId: string }>(xs: T[], id: string) => xs.filter((x) => x.patientId === id)
const patientOf = (scenario: string) => patients.find((p) => p.scenario === scenario)?.patientId ?? 'missing'
const latestPlan = (id: string) => byPatient(plans, id).at(-1) as Plan
const pending = suggestions.filter((s) => !decisions.some((d) => d.suggestionId === s.suggestionId))

describe('fixtures: shape and privacy', () => {
  it('has five synthetic patients with opaque ids', () => {
    expect(patients.map((p) => p.label)).toEqual(['SYN-01', 'SYN-02', 'SYN-03', 'SYN-04', 'SYN-05'])
    for (const p of patients) expect(p.patientId).toMatch(/^pt-[0-9a-f]{8}$/)
  })

  it('carries no names, dates of birth or contact details', () => {
    const forbidden = /^(name|given|family|birthDate|address|telecom|phone|email)$/i
    const keys = new Set<string>()
    JSON.stringify({ patients, braces, plans, suggestions, decisions, sessions }, (k, v) => (keys.add(k), v))
    expect([...keys].filter((k) => forbidden.test(k))).toEqual([])
  })

  it('passes every domain schema unchanged', () => {
    for (const p of plans) expect(validatePlan(p).success).toBe(true)
    for (const s of sessions) expect(SessionSummarySchema.parse(s)).toEqual(s)
    for (const s of suggestions) expect(AiSuggestionSchema.parse(s)).toEqual(s)
    for (const d of decisions) expect(ParameterDecisionSchema.parse(d)).toEqual(d)
    for (const b of braces) expect(BraceSchema.parse(b)).toEqual(b)
  })

  it('is deterministic', () => {
    expect(generatePatient(PROFILES[0]!)).toEqual(generatePatient(PROFILES[0]!))
  })
})

describe('fixtures: domain rules hold across six weeks', () => {
  it.each(patients)('$label: versions increase, the reference MVC only goes up', ({ patientId }) => {
    const ps = byPatient(plans, patientId)
    ps.forEach((p, i) => {
      const prev = ps[i - 1] ?? null
      expect(nextVersionOk(prev?.version ?? null, p.version)).toBe(true)
      expect(referenceMvcUpdateOk(prev?.referenceMvc ?? null, p.referenceMvc)).toBe(true)
    })
    expect(new Set(ps.map((p) => p.referenceMvc.value)).size).toBeGreaterThan(1)
  })

  it.each(patients)('$label: sessions follow the usage limits and run on a valid plan', ({ patientId }) => {
    const ss = byPatient(sessions, patientId)
    const days = new Map<string, number>()
    ss.forEach((s, i) => {
      const day = s.startedAt.slice(0, 10)
      days.set(day, (days.get(day) ?? 0) + 1)
      const prev = ss[i - 1]
      if (prev) expect(Date.parse(s.startedAt) - Date.parse(prev.endedAt)).toBeGreaterThanOrEqual(LIMITS.minGapH * HOUR)
      const plan = plans.find((p) => p.planId === s.planId && p.version === s.planVersion)
      expect(plan).toBeDefined()
      if (!plan) return
      expect(Date.parse(plan.issuedAt)).toBeLessThanOrEqual(Date.parse(s.startedAt))
      expect(isPlanExpired(plan, new Date(s.startedAt))).toBe(false)
      expect(s.contractionsDone).toBe(s.perContraction.length)
      for (const c of s.perContraction) {
        expect(c.commandedMa).toBeGreaterThanOrEqual(plan.floorFraction * plan.ceilingMa - 1e-9)
        expect(c.commandedMa).toBeLessThanOrEqual(plan.ceilingMa)
      }
      expect(Date.parse(s.startedAt)).toBeLessThan(now.getTime())
    })
    expect(Math.max(...days.values())).toBeLessThanOrEqual(LIMITS.sessionsPerDay)
    // Six weeks: from day 2 to at least day 41 of the synthetic calendar.
    expect((Date.parse(ss.at(-1)!.startedAt) - Date.parse(ss[0]!.startedAt)) / (24 * HOUR)).toBeGreaterThan(38)
  })

  it('every approved plan matches its three decisions, and every override has a reason', () => {
    for (const p of plans.filter((x) => x.version > 1)) {
      const ds = decisions.filter((d) => d.planId === p.planId && d.planVersion === p.version)
      expect(ds.map((d) => [d.parameter, d.approvedValue])).toEqual([['ceilingMa', p.ceilingMa], ['offS', p.offS], ['contractions', p.contractions]])
    }
    expect(decisions.some((d) => d.action === 'override')).toBe(true)
  })
})

describe('fixtures: scenarios', () => {
  it('SYN-03 has the only pain-related STOP, and its next suggestion is clamped and pending', () => {
    const stops = sessions.filter((s) => s.safeStopCause === 'stop-button')
    expect(stops.map((s) => [s.patientId, s.pain])).toEqual([[patientOf('pain-related-stop'), 6]])
    const next = byPatient(pending, patientOf('pain-related-stop'))
    expect(next.map((s) => s.ceilingMa.clampReason)).toEqual(['pain-or-guarding'])
    expect(next[0]?.basedOnSessionId).toBe(stops[0]?.sessionId)
  })

  it('SYN-04 is the only patient whose latest plan has expired', () => {
    expect(patients.filter((p) => isPlanExpired(latestPlan(p.patientId), now)).map((p) => p.label)).toEqual(['SYN-04'])
    expect(byPatient(pending, patientOf('expired-plan')).length).toBeGreaterThan(0)
  })

  it('SYN-02 has one degraded session (no fatigue index) and one device stop', () => {
    const b = byPatient(sessions, patientOf('degraded-session'))
    expect(b.filter((s) => s.degraded).map((s) => [s.mode, s.fatigueMdfDropPct])).toEqual([[1, null]])
    expect(b.filter((s) => s.safeStopCause).map((s) => s.safeStopCause)).toEqual(['lead-off'])
    expect(sessions.filter((s) => s.degraded)).toHaveLength(1)
  })

  it('SYN-05 runs Mode 0 at a fixed dose with lower adherence', () => {
    const e = byPatient(sessions, patientOf('low-adherence'))
    expect(e.every((s) => s.mode === 0 && s.perContraction.every((c) => c.commandedMa === planOf(s).ceilingMa))).toBe(true)
    expect(e.length).toBeLessThan(byPatient(sessions, patientOf('typical')).length)
  })

  it('shows the clamp rules the clinician will see', () => {
    const reasons = new Set(suggestions.map((s) => s.ceilingMa.clampReason))
    for (const r of ['max-increase', 'ceiling-cap', 'pain-or-guarding']) expect(reasons.has(r as never)).toBe(true)
    expect(suggestions.every((s) => s.dataBasis === 'simulated')).toBe(true)
  })
})

function planOf(s: { planId: string; planVersion: number }) {
  return plans.find((p) => p.planId === s.planId && p.version === s.planVersion) as Plan
}
