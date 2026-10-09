import { describe, expect, it } from 'vitest'
import {
  AiSuggestionSchema,
  CLAMP_REASONS,
  LIMITS,
  MODEL_A_LABELS,
  ParameterDecisionSchema,
  SAFE_STOP_CAUSES,
  clampSuggestion,
  type AiSuggestion,
  type ClampContext,
  type ParameterDecision,
} from './index'

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type RuleSession = ClampContext['sessionsSinceApproval'][number]
const contractions = (labels: string) =>
  [...labels].map((l, index) => ({
    index,
    aV: 25,
    commandedMa: 20,
    peakMa: 20,
    modelALabel: ({ g: 'guarding', o: 'on-target', u: 'under', f: 'fatigued' } as const)[l as 'g' | 'o' | 'u' | 'f'],
  }))
const session = (over: Partial<RuleSession> = {}): RuleSession => ({ pain: 1, perContraction: [], safeStopCause: null, ...over })
const ctx = (lastCeilingMa: number, ...sessionsSinceApproval: RuleSession[]): ClampContext => ({ lastCeilingMa, sessionsSinceApproval })
const raw = (ceilingMa: number, offS = 45, contractions = 10) => ({ ceilingMa, offS, contractions })

const reason = { feature: 'comfort', text: 'comfort rating 3/3', contribution: 0.41 }
const contractExample: AiSuggestion = {
  suggestionId: '8b4c2a1e-6f3d-4e5a-9b7c-0d1e2f3a4b5c',
  patientId: 'pt-test01',
  basedOnSessionId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  ceilingMa: { value: 35, reasons: [reason, { feature: 'day', text: 'day 29', contribution: 0.22 }], clamped: false, clampReason: null },
  offS: { value: 45, reasons: [reason, reason], clamped: false, clampReason: null },
  contractions: { value: 15, reasons: [reason, reason], clamped: false, clampReason: null },
  dataBasis: 'simulated',
}

describe('AiSuggestionSchema', () => {
  it('accepts the CONTRACT.md §3 example with two reasons per value', () => {
    expect(AiSuggestionSchema.safeParse(contractExample).success).toBe(true)
  })
  it('refuses wrong reason counts, inconsistent clamp flags, out-of-limit values and non-simulated data', () => {
    const bad = [
      { ...contractExample, offS: { ...contractExample.offS, reasons: [reason] } },
      { ...contractExample, offS: { ...contractExample.offS, reasons: [reason, reason, reason] } },
      { ...contractExample, ceilingMa: { ...contractExample.ceilingMa, clamped: true } },
      { ...contractExample, ceilingMa: { ...contractExample.ceilingMa, clampReason: 'ceiling-cap' } },
      { ...contractExample, ceilingMa: { ...contractExample.ceilingMa, value: 51 } },
      { ...contractExample, offS: { ...contractExample.offS, value: 50 } },
      { ...contractExample, dataBasis: 'real' },
    ]
    for (const s of bad) expect(AiSuggestionSchema.safeParse(s).success).toBe(false)
  })
})

describe('clampSuggestion rules', () => {
  const cases: [string, number, ClampContext, number, string | null][] = [
    ['+10 mA rule', 42, ctx(30, session()), 40, 'max-increase'],
    ['+10 mA exactly is allowed', 40, ctx(30, session()), 40, null],
    ['no sessions yet: +10 mA rule', 45, ctx(30), 40, 'max-increase'],
    ['50 mA cap', 58, ctx(45, session()), 50, 'ceiling-cap'],
    ['cap and +10 meet at 50', 52, ctx(40, session()), 50, 'ceiling-cap'],
    ['pain 4 gives -5 mA', 33, ctx(30, session({ pain: 4 })), 25, 'pain-or-guarding'],
    ['pain 3 does not', 33, ctx(30, session({ pain: 3 })), 33, null],
    ['pain not entered does not', 33, ctx(30, session({ pain: null })), 33, null],
    ['pain in an earlier session since approval', 33, ctx(30, session({ pain: 7 }), session()), 25, 'pain-or-guarding'],
    ['guarding above 30 %', 30, ctx(30, session({ perContraction: contractions('oog') })), 25, 'pain-or-guarding'],
    ['guarding at exactly 30 % does not', 30, ctx(30, session({ perContraction: contractions('oooooooggg') })), 30, null],
    ['a larger drop from the model is kept', 20, ctx(30, session({ pain: 5 })), 20, null],
    ['-5 mA cannot go below 10 mA', 15, ctx(12, session({ pain: 6 })), 10, 'pain-or-guarding'],
    ['STOP press blocks an increase', 35, ctx(30, session({ safeStopCause: 'stop-button' })), 30, 'stop-pressed'],
    ['STOP press allows a decrease', 28, ctx(30, session({ safeStopCause: 'stop-button' })), 28, null],
    ['pain rule wins over STOP', 35, ctx(30, session({ safeStopCause: 'stop-button', pain: 6 })), 25, 'pain-or-guarding'],
    ['a device stop is not a STOP press', 35, ctx(30, session({ safeStopCause: 'lead-off' })), 35, null],
    ['10 mA minimum', 4, ctx(20, session()), 10, 'ceiling-min'],
    ['rounds to the 1 mA step', 29.6, ctx(30, session()), 30, null],
  ]
  it.each(cases)('%s', (_name, ceiling, context, value, clampReason) => {
    const out = clampSuggestion(raw(ceiling), context).ceilingMa
    expect(out).toEqual({ value, clamped: clampReason !== null, clampReason })
  })

  it('snaps OFF time and contractions to allowed values, ties to the gentler one', () => {
    const offS = (v: number) => clampSuggestion(raw(30, v), ctx(30)).offS
    const count = (v: number) => clampSuggestion(raw(30, 45, v), ctx(30)).contractions
    expect(offS(45)).toEqual({ value: 45, clamped: false, clampReason: null })
    expect(offS(50)).toEqual({ value: 45, clamped: true, clampReason: 'not-allowed-value' })
    expect([offS(37.5).value, offS(75).value, offS(0).value, offS(1000).value]).toEqual([45, 90, 30, 90])
    expect(count(15)).toEqual({ value: 15, clamped: false, clampReason: null })
    expect([count(12.5).value, count(13).value, count(17.5).value, count(100).value, count(-5).value]).toEqual([10, 15, 15, 20, 10])
  })

  it('throws on non-finite values or a last ceiling outside the limits', () => {
    for (const r of [raw(NaN), raw(Infinity), raw(30, NaN), raw(30, 45, -Infinity)]) expect(() => clampSuggestion(r, ctx(30))).toThrow(RangeError)
    for (const last of [9, 51, 30.5, NaN]) expect(() => clampSuggestion(raw(30), ctx(last))).toThrow(RangeError)
  })
})

describe('clampSuggestion output always lies inside the limits (10,000 random cases)', () => {
  it('holds every rule', () => {
    const rng = mulberry32(42)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)] as T
    const wide = (lo: number, hi: number) => (rng() < 0.05 ? (rng() - 0.5) * 2e12 : lo + rng() * (hi - lo))
    const failures: unknown[] = []
    const reasonsSeen = new Set<string>()
    for (let i = 0; i < 10_000; i++) {
      const last = 10 + Math.floor(rng() * 41)
      const sessions = Array.from({ length: Math.floor(rng() * 4) }, () =>
        session({
          pain: rng() < 0.1 ? null : Math.floor(rng() * 11),
          perContraction: Array.from({ length: Math.floor(rng() * 21) }, (_, index) => ({
            index, aV: 20, commandedMa: 20, peakMa: 20, modelALabel: pick(MODEL_A_LABELS),
          })),
          safeStopCause: rng() < 0.6 ? null : pick(SAFE_STOP_CAUSES),
        }),
      )
      const r = { ceilingMa: wide(-50, 120), offS: wide(-20, 150), contractions: wide(-5, 40) }
      const out = clampSuggestion(r, ctx(last, ...sessions))
      const c = out.ceilingMa
      // Independent restatement of the spec rules.
      const pained = sessions.some(
        (s) => (s.pain ?? 0) >= 4 || s.perContraction.filter((x) => x.modelALabel === 'guarding').length * 100 > 30 * s.perContraction.length,
      )
      const stopped = sessions.some((s) => s.safeStopCause === 'stop-button')
      const ruleMax = pained ? Math.max(LIMITS.ceilingMa.min, last - 5) : stopped ? last : last + 10
      const suggestion = {
        ...contractExample,
        ceilingMa: { ...out.ceilingMa, reasons: [reason, reason] },
        offS: { ...out.offS, reasons: [reason, reason] },
        contractions: { ...out.contractions, reasons: [reason, reason] },
      }
      const ok =
        Number.isInteger(c.value) &&
        c.value >= LIMITS.ceilingMa.min &&
        c.value <= LIMITS.ceilingMa.max &&
        c.value <= ruleMax &&
        c.clamped === (c.value !== Math.round(r.ceilingMa)) &&
        (LIMITS.offS.allowed as readonly number[]).includes(out.offS.value) &&
        (LIMITS.contractions.allowed as readonly number[]).includes(out.contractions.value) &&
        out.offS.clamped === !(LIMITS.offS.allowed as readonly number[]).includes(r.offS) &&
        out.contractions.clamped === !(LIMITS.contractions.allowed as readonly number[]).includes(r.contractions) &&
        AiSuggestionSchema.safeParse(suggestion).success
      if (!ok) failures.push({ last, sessions, r, out })
      for (const v of [out.ceilingMa, out.offS, out.contractions]) if (v.clampReason) reasonsSeen.add(v.clampReason)
    }
    expect(failures).toEqual([])
    expect([...reasonsSeen].sort()).toEqual([...CLAMP_REASONS].sort()) // the sweep reached every rule
  })
})

describe('ParameterDecisionSchema', () => {
  const accept: ParameterDecision = {
    decisionId: '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f',
    suggestionId: contractExample.suggestionId,
    planId: '3f1d5c7e-8a2b-4c6d-9e0f-1a2b3c4d5e6f',
    planVersion: 4,
    parameter: 'ceilingMa',
    suggestedValue: 35,
    approvedValue: 35,
    action: 'accept',
    reason: null,
    decidedBy: 'pr-001',
    decidedAt: '2026-03-02T07:30:00.000Z',
  }
  const override: ParameterDecision = { ...accept, action: 'override', approvedValue: 32, reason: 'Smaller increase; review tomorrow' }
  it('accepts a plain accept and a reasoned override', () => {
    expect(ParameterDecisionSchema.safeParse(accept).success).toBe(true)
    expect(ParameterDecisionSchema.safeParse(override).success).toBe(true)
  })
  it('refuses inconsistent or out-of-limit decisions', () => {
    for (const d of [
      { ...accept, approvedValue: 32 },
      { ...accept, reason: 'fine' },
      { ...override, reason: null },
      { ...override, approvedValue: 35 },
      { ...override, approvedValue: 55 },
      { ...override, parameter: 'offS', suggestedValue: 45, approvedValue: 50 },
      { ...override, reason: 'x'.repeat(281) },
    ]) {
      expect(ParameterDecisionSchema.safeParse(d).success).toBe(false)
    }
  })
})
