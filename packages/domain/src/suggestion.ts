import { z } from 'zod'
import { LIMITS } from './limits'
import { CeilingMa, Contractions, Instant, OffS, OpaqueId } from './plan'
import type { SessionSummary } from './session'

/** The three parameters the AI suggests and the clinician accepts or overrides one by one. */
export const PLAN_PARAMETERS = ['ceilingMa', 'offS', 'contractions'] as const
export type PlanParameter = (typeof PLAN_PARAMETERS)[number]
const VALUE_SCHEMAS = { ceilingMa: CeilingMa, offS: OffS, contractions: Contractions }

export const CLAMP_REASONS = [
  'max-increase', // +10 mA per session
  'pain-or-guarding', // -5 mA after pain >= 4/10 or guarding > 30 %
  'stop-pressed', // no increase after a STOP press
  'ceiling-cap', // 50 mA cap
  'ceiling-min', // 10 mA minimum
  'not-allowed-value', // snapped to an allowed OFF time or contraction count
] as const
export const ClampReasonSchema = z.enum(CLAMP_REASONS)
export type ClampReason = z.infer<typeof ClampReasonSchema>

const ReasonSchema = z.object({
  feature: z.string().min(1).max(64),
  text: z.string().min(1).max(160),
  contribution: z.number(),
})

const suggestedValue = <T extends z.ZodType<number>>(value: T) =>
  z
    .object({
      value,
      reasons: z.tuple([ReasonSchema, ReasonSchema]), // exactly two reasons per value
      clamped: z.boolean(),
      clampReason: ClampReasonSchema.nullable(),
    })
    .refine((v) => v.clamped === (v.clampReason !== null), { message: 'clampReason is set exactly when clamped' })

/** AI suggestion (CONTRACT.md §3), already clamped by the rules, labelled simulated. */
export const AiSuggestionSchema = z.object({
  suggestionId: z.uuid(),
  patientId: OpaqueId,
  basedOnSessionId: z.uuid(),
  ceilingMa: suggestedValue(CeilingMa),
  offS: suggestedValue(OffS),
  contractions: suggestedValue(Contractions),
  dataBasis: z.literal('simulated'),
})
export type AiSuggestion = z.infer<typeof AiSuggestionSchema>

/** One clinician decision on one suggested parameter (FHIR Provenance). */
export const ParameterDecisionSchema = z
  .object({
    decisionId: z.uuid(),
    suggestionId: z.uuid(),
    planId: z.uuid(),
    planVersion: z.int().min(1),
    parameter: z.enum(PLAN_PARAMETERS),
    suggestedValue: z.number(),
    approvedValue: z.number(),
    action: z.enum(['accept', 'override']),
    reason: z.string().min(1).max(280).nullable(),
    decidedBy: OpaqueId,
    decidedAt: Instant,
  })
  .superRefine((d, ctx) => {
    const schema = VALUE_SCHEMAS[d.parameter]
    for (const key of ['suggestedValue', 'approvedValue'] as const) {
      if (!schema.safeParse(d[key]).success) ctx.addIssue({ code: 'custom', path: [key], message: 'outside the limits' })
    }
    const same = d.approvedValue === d.suggestedValue
    if (d.action === 'accept' && (!same || d.reason !== null)) {
      ctx.addIssue({ code: 'custom', path: ['action'], message: 'an accept keeps the suggested value and has no reason' })
    }
    if (d.action === 'override' && (same || d.reason === null)) {
      ctx.addIssue({ code: 'custom', path: ['action'], message: 'an override changes the value and needs a reason' })
    }
  })
export type ParameterDecision = z.infer<typeof ParameterDecisionSchema>

export type RawSuggestion = { ceilingMa: number; offS: number; contractions: number }
export type ClampContext = {
  /** Ceiling of the last approved plan. */
  lastCeilingMa: number
  /** Every session run since that approval: the rules hold until the clinician reviews. */
  sessionsSinceApproval: readonly Pick<SessionSummary, 'pain' | 'perContraction' | 'safeStopCause'>[]
}
export type ClampedValue<V extends number = number> = { value: V; clamped: boolean; clampReason: ClampReason | null }

type RuleSession = ClampContext['sessionsSinceApproval'][number]

const guardingPct = (s: RuleSession) =>
  s.perContraction.length === 0
    ? 0
    : (100 * s.perContraction.filter((c) => c.modelALabel === 'guarding').length) / s.perContraction.length

const painOrGuarding = (s: RuleSession) =>
  (s.pain !== null && s.pain >= LIMITS.ai.painThreshold) || guardingPct(s) > LIMITS.ai.guardingPctThreshold

function clampCeiling(raw: number, { lastCeilingMa: last, sessionsSinceApproval: sessions }: ClampContext): ClampedValue {
  const { min, max, step } = LIMITS.ceilingMa
  const [limit, reason]: [number, ClampReason] = sessions.some(painOrGuarding)
    ? [last + LIMITS.ai.decreaseMaAfterPainOrGuarding, 'pain-or-guarding']
    : sessions.some((s) => s.safeStopCause === 'stop-button') // any STOP press counts as pain-related
      ? [last, 'stop-pressed']
      : [last + LIMITS.ai.maxIncreaseMaPerSession, 'max-increase']
  const upper = Math.max(min, Math.min(max, limit))
  const value = Math.round(raw / step) * step
  if (value > upper) return { value: upper, clamped: true, clampReason: limit < max ? reason : 'ceiling-cap' }
  if (value < min) return { value: min, clamped: true, clampReason: 'ceiling-min' }
  return { value, clamped: false, clampReason: null }
}

/** Nearest allowed value; a tie goes to the gentler one ('up' = longer rest, 'down' = fewer contractions). */
function snap<A extends readonly number[]>(raw: number, allowed: A, tie: 'up' | 'down'): ClampedValue<A[number]> {
  const value = allowed.reduce((best, a) => {
    const d = Math.abs(a - raw) - Math.abs(best - raw)
    return d < 0 || (d === 0 && (tie === 'up' ? a > best : a < best)) ? a : best
  })
  return value === raw ? { value, clamped: false, clampReason: null } : { value, clamped: true, clampReason: 'not-allowed-value' }
}

/**
 * Applies the rules of spec VIII.2 to the model's raw output before a clinician sees it:
 * at most +10 mA per session, -5 mA after pain >= 4/10 or guarding > 30 %, no increase after a
 * STOP press, then the 50 mA cap. The output always lies inside LIMITS; bad input throws.
 */
export function clampSuggestion(raw: RawSuggestion, ctx: ClampContext) {
  if (![raw.ceilingMa, raw.offS, raw.contractions].every(Number.isFinite)) {
    throw new RangeError('raw suggestion values must be finite numbers')
  }
  if (!CeilingMa.safeParse(ctx.lastCeilingMa).success) {
    throw new RangeError('lastCeilingMa must be an approved ceiling inside the limits')
  }
  return {
    ceilingMa: clampCeiling(raw.ceilingMa, ctx),
    offS: snap(raw.offS, LIMITS.offS.allowed, 'up'),
    contractions: snap(raw.contractions, LIMITS.contractions.allowed, 'down'),
  }
}
