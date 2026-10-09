import {
  AiSuggestionSchema,
  LIMITS,
  PLAN_PARAMETERS,
  ParameterDecisionSchema,
  PlanSchema,
  clampSuggestion,
  isPlanExpired,
  type AiSuggestion,
  type Brace,
  type ParameterDecision,
  type Plan,
  type PlanParameter,
  type ReferenceMvc,
  type SessionSummary,
} from '@symbiomed/domain'
import type { Profile } from './profiles'
import { between, hex, mulberry32, pick, round1, round2, uuid, type Rng } from './random'
import { FIRMWARE, makeSession } from './session'

const HOUR = 3_600_000
/** Synthetic calendar: day 0 is the synthetic surgery day of every fixture patient. */
const DAY0 = Date.UTC(2026, 0, 5)
export const at = (day: number, hour: number, minute = 0) => DAY0 + (day * 24 + hour) * HOUR + minute * 60_000
export const NOW_MS = at(43, 12) // last day of week 6, midday
export const PRACTITIONERS = ['pr-001', 'pr-002'] as const
const MVC_VISITS = [15, 29] // clinic visits that record a higher reference MVC
const iso = (ms: number) => new Date(ms).toISOString()

const OVERRIDES: Record<PlanParameter, [change: (v: number) => number, reason: string]> = {
  ceilingMa: [(v) => (v >= 12 ? v - 2 : v + 2), 'Smaller step; review at the next approval'],
  offS: [(v) => ({ 30: 45, 45: 60, 60: 90, 90: 60 } as Record<number, number>)[v] ?? 60, 'Keep a longer rest this week'],
  contractions: [(v) => ({ 10: 15, 15: 10, 20: 15 } as Record<number, number>)[v] ?? 10, 'Stay at the current number of contractions this week'],
}

type Reason = AiSuggestion['ceilingMa']['reasons'][number]

/** Model B stand-in: a raw suggestion, then the real clamp rules from @symbiomed/domain. */
function suggest(rng: Rng, p: Profile, day: number, plan: Plan, basis: SessionSummary, sinceApproval: SessionSummary[]): AiSuggestion {
  const comfort = basis.comfort ?? 2
  const pain = basis.pain ?? 0
  const delta = pain >= LIMITS.ai.painThreshold ? -between(rng, 2, 4) : comfort === 3 ? between(rng, 1, 4) : comfort === 2 ? between(rng, 0, 3) : between(rng, -2, 1)
  let ceilingMa = plan.ceilingMa + delta
  if (ceilingMa > p.toleranceMa) ceilingMa = p.toleranceMa + between(rng, -1.5, 1.5)
  if (day === p.bigStepDay) ceilingMa = plan.ceilingMa + 13
  const week = Math.ceil((day - 1) / 7)
  const raw = { ceilingMa, offS: week <= 2 ? 60 : week <= 4 ? 45 : pick(rng, [45, 30]), contractions: week <= 2 ? 10 : week <= 4 ? 15 : 20 }
  const clamped = clampSuggestion(raw, { lastCeilingMa: plan.ceilingMa, sessionsSinceApproval: sinceApproval })

  const top = round2(between(rng, 0.3, 0.5))
  const second = round2(between(rng, 0.1, top - 0.05))
  const two = (a: [string, string], b: [string, string]): [Reason, Reason] => [
    { feature: a[0], text: a[1], contribution: top },
    { feature: b[0], text: b[1], contribution: second },
  ]
  const activation = round1(basis.perContraction.reduce((s, c) => s + c.aV, 0) / Math.max(1, basis.perContraction.length))
  const dayReason: [string, string] = ['day', `day ${day}`]
  return AiSuggestionSchema.parse({
    suggestionId: uuid(rng),
    patientId: plan.patientId,
    basedOnSessionId: basis.sessionId,
    ceilingMa: {
      ...clamped.ceilingMa,
      reasons: pain >= LIMITS.ai.painThreshold ? two(['pain', `pain rating ${pain}/10`], ['comfort', `comfort rating ${comfort}/3`])
        : basis.comfort === null ? two(['activation', `activation ${activation} % of reference MVC`], dayReason)
        : two(['comfort', `comfort rating ${comfort}/3`], dayReason),
    },
    offS: {
      ...clamped.offS,
      reasons: basis.fatigueMdfDropPct === null ? two(['flexion', `knee flexion ${Math.round(basis.flexionMaxDeg)}°`], dayReason)
        : two(['fatigue', `fatigue drop ${basis.fatigueMdfDropPct} %`], dayReason),
    },
    contractions: { ...clamped.contractions, reasons: two(['activation', `activation ${activation} % of reference MVC`], dayReason) },
    dataBasis: 'simulated',
  })
}

/** The clinician accepts or overrides each parameter (simulated: mostly accepts). */
function decide(rng: Rng, s: AiSuggestion, planId: string, planVersion: number, decidedAt: number): ParameterDecision[] {
  const overridden = rng() < 0.25 ? pick(rng, PLAN_PARAMETERS) : null
  const decidedBy = pick(rng, PRACTITIONERS)
  return PLAN_PARAMETERS.map((parameter) => {
    const suggestedValue = s[parameter].value
    const [change, reason] = OVERRIDES[parameter]
    const o = parameter === overridden
    return ParameterDecisionSchema.parse({
      decisionId: uuid(rng), suggestionId: s.suggestionId, planId, planVersion, parameter, suggestedValue,
      approvedValue: o ? change(suggestedValue) : suggestedValue,
      action: o ? 'override' : 'accept', reason: o ? reason : null, decidedBy, decidedAt: iso(decidedAt),
    })
  })
}

export type PatientFixture = ReturnType<typeof generatePatient>

/** Six weeks of one synthetic patient: daily approvals at 07:30, sessions about 08:00 and 15:00. */
export function generatePatient(p: Profile) {
  const rng = mulberry32(p.seed)
  const patientId = `pt-${hex(rng, 8)}`
  const planId = uuid(rng)
  const brace: Brace = { braceId: `br-${hex(rng, 6)}`, serial: `SMB-${p.seed}`, firmwareVersion: FIRMWARE, patientId }
  const plans: Plan[] = []
  const suggestions: AiSuggestion[] = []
  const decisions: ParameterDecision[] = []
  const sessions: SessionSummary[] = []
  let referenceMvc: ReferenceMvc = { value: p.mvcMv, unit: LIMITS.referenceMvcUnit, recordedAt: iso(at(2, 9, 30)), recordedBy: PRACTITIONERS[0] }
  let pendingBasis: string | null = null // basis of a suggestion still waiting for approval
  let stopped = false // no session after a pain-related STOP until the clinician reviews

  const approve = (approvedAt: number, values: Pick<Plan, PlanParameter>, approvedBy: string) => {
    plans.push(PlanSchema.parse({
      planId, patientId, version: plans.length + 1,
      issuedAt: iso(approvedAt), expiresAt: iso(approvedAt + LIMITS.validityH.default * HOUR),
      pulseWidthUs: p.pulseWidthUs, ...values, floorFraction: p.floorFraction, aTargetPctMvc: LIMITS.aTargetPctMvc.default,
      referenceMvc, approvedBy, approvedAt: iso(approvedAt),
    }))
  }

  for (let day = 2; day <= 43; day++) {
    // 1. One approval before the day's sessions (day 2: first plan set at the clinic).
    if (day === 2) approve(at(2, 10), p.firstPlan, PRACTITIONERS[0])
    else {
      const current = plans.at(-1) as Plan
      const basis = sessions.at(-1)
      if (basis && basis.sessionId !== pendingBasis) {
        const sinceApproval = sessions.filter((s) => s.planVersion === current.version)
        const s = suggest(rng, p, day, current, basis, sinceApproval)
        suggestions.push(s)
        if (day <= p.lastApprovalDay) {
          const ds = decide(rng, s, planId, current.version + 1, at(day, 7, 30))
          decisions.push(...ds)
          const value = (k: PlanParameter) => ds.find((d) => d.parameter === k)?.approvedValue
          approve(at(day, 7, 30), { ceilingMa: value('ceilingMa'), offS: value('offS'), contractions: value('contractions') } as Pick<Plan, PlanParameter>, ds[0]?.decidedBy ?? PRACTITIONERS[0])
          pendingBasis = null
        } else pendingBasis = basis.sessionId
      }
    }
    // 2. Up to two sessions, only on a plan that is valid when the session starts.
    for (const slot of [0, 1] as const) {
      const start = day === 2 ? at(2, slot ? 15 : 10, 30) : at(day, slot ? 15 : 8, Math.floor(rng() * 40))
      const event = p.events[`${day}-${slot}`] ?? null
      const attends = day === 2 || event !== null || rng() < p.adherence
      const plan = plans.at(-1) as Plan
      if (stopped || !attends || start >= NOW_MS || isPlanExpired(plan, new Date(start))) continue
      sessions.push(makeSession(rng, p, plan, day, start, event))
      if (event === 'pain-stop') stopped = true
    }
    if (MVC_VISITS.includes(day)) {
      referenceMvc = { ...referenceMvc, value: round2(referenceMvc.value + between(rng, 0.03, 0.08)), recordedAt: iso(at(day, 11)) }
    }
  }
  return { patientId, label: p.label, scenario: p.scenario, surgeryAt: iso(at(0, 9)), brace, plans, suggestions, decisions, sessions }
}
