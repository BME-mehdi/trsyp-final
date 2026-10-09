import type { ApproveRequest } from '@symbiomed/api-client'
import { LIMITS, PLAN_PARAMETERS, type AiSuggestion, type Plan, type PlanParameter, type SessionSummary } from '@symbiomed/domain'

// Pure logic of the next-session panel. Range checks here are a convenience for the clinician:
// the BFF validates the plan again with @symbiomed/domain, and the brace once more.

export type Choice = { action: 'accept' | 'override' | null; value: string; reason: string }
export type Draft = {
  choices: Record<PlanParameter, Choice>
  floorFraction: string
  pulseWidthUs: string
  validityH: string
  referenceMvc: string
}
export type Field = PlanParameter | 'floorFraction' | 'pulseWidthUs' | 'validityH' | 'referenceMvc' | `${PlanParameter}Reason`

export const PARAMETER_LABEL: Record<PlanParameter, { name: string; unit: string }> = {
  ceilingMa: { name: 'Intensity ceiling', unit: 'mA' },
  offS: { name: 'OFF time between contractions', unit: 's' },
  contractions: { name: 'Contractions per session', unit: '' },
}
export const CLAMP_TEXT: Record<string, string> = {
  'max-increase': 'at most +10 mA per session',
  'pain-or-guarding': '−5 mA after pain of 4/10 or more, or guarding above 30 %',
  'stop-pressed': 'no increase after a STOP press',
  'ceiling-cap': '50 mA cap',
  'ceiling-min': '10 mA minimum',
  'not-allowed-value': 'rounded to an allowed value',
}

const empty = (): Choice => ({ action: null, value: '', reason: '' })
export const initialDraft = (plan: Plan): Draft => ({
  choices: { ceilingMa: empty(), offS: empty(), contractions: empty() },
  floorFraction: String(plan.floorFraction),
  pulseWidthUs: String(plan.pulseWidthUs),
  validityH: String(LIMITS.validityH.default),
  referenceMvc: String(plan.referenceMvc.value),
})

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
const whole = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max
const CHECK: Record<PlanParameter | 'floorFraction' | 'pulseWidthUs' | 'validityH', [(v: number) => boolean, string]> = {
  ceilingMa: [(v) => whole(v, LIMITS.ceilingMa.min, LIMITS.ceilingMa.max), `Enter a whole number from ${LIMITS.ceilingMa.min} to ${LIMITS.ceilingMa.max} mA.`],
  offS: [(v) => (LIMITS.offS.allowed as readonly number[]).includes(v), `Choose ${LIMITS.offS.allowed.join(', ')} s.`],
  contractions: [(v) => (LIMITS.contractions.allowed as readonly number[]).includes(v), `Choose ${LIMITS.contractions.allowed.join(', ')}.`],
  floorFraction: [(v) => v >= LIMITS.floorFraction.min && v <= LIMITS.floorFraction.max, `Enter ${LIMITS.floorFraction.min} to ${LIMITS.floorFraction.max}.`],
  pulseWidthUs: [(v) => whole(v, LIMITS.pulseWidthUs.min, LIMITS.pulseWidthUs.max), `Enter a whole number from ${LIMITS.pulseWidthUs.min} to ${LIMITS.pulseWidthUs.max} µs.`],
  validityH: [(v) => whole(v, LIMITS.validityH.min, LIMITS.validityH.max), `Enter a whole number from ${LIMITS.validityH.min} to ${LIMITS.validityH.max} h.`],
}

export type Review = {
  errors: Partial<Record<Field, string>>
  decided: number
  complete: boolean
  final: Record<PlanParameter | 'floorFraction' | 'pulseWidthUs' | 'validityH' | 'referenceMvc', number>
  warnings: string[]
  request: ApproveRequest | null
}

export function review(draft: Draft, plan: Plan, s: AiSuggestion, last: SessionSummary | null, practitionerId: string, now = new Date()): Review {
  const errors: Review['errors'] = {}
  const final = {} as Review['final']
  for (const p of PLAN_PARAMETERS) {
    const c = draft.choices[p]
    if (c.action === 'accept') final[p] = s[p].value
    if (c.action !== 'override') continue
    const v = num(c.value)
    final[p] = v
    if (!CHECK[p][0](v)) errors[p] = CHECK[p][1]
    else if (v === s[p].value) errors[p] = 'Same as the suggestion: choose Accept instead.'
    if (c.reason.trim() === '') errors[`${p}Reason`] = 'A reason is required when you override.'
    else if (c.reason.length > 280) errors[`${p}Reason`] = 'Keep the reason under 280 characters.'
  }
  for (const f of ['floorFraction', 'pulseWidthUs', 'validityH'] as const) {
    final[f] = num(draft[f])
    if (!CHECK[f][0](final[f])) errors[f] = CHECK[f][1]
  }
  final.referenceMvc = num(draft.referenceMvc)
  if (!(final.referenceMvc >= plan.referenceMvc.value)) errors.referenceMvc = `The reference MVC can only go up: at least ${plan.referenceMvc.value} mV.`

  const decided = PLAN_PARAMETERS.filter((p) => draft.choices[p].action !== null).length
  const complete = decided === PLAN_PARAMETERS.length && Object.keys(errors).length === 0

  const warnings: string[] = []
  const rise = final.ceilingMa - plan.ceilingMa
  if (rise > LIMITS.ai.maxIncreaseMaPerSession) warnings.push(`The ceiling rises by ${rise} mA (from ${plan.ceilingMa} to ${final.ceilingMa} mA), more than the 10 mA per-session rule.`)
  if (last?.pain != null && last.pain >= LIMITS.ai.painThreshold) warnings.push(`The last session had pain ${last.pain}/10. The rules hold any increase until you have reviewed it.`)
  if (last?.safeStopCause === 'stop-button') warnings.push('The last session ended with a STOP press (counted as pain-related).')

  const request: ApproveRequest | null = complete
    ? {
        suggestionId: s.suggestionId,
        version: plan.version + 1,
        plan: {
          pulseWidthUs: final.pulseWidthUs,
          ceilingMa: final.ceilingMa,
          floorFraction: final.floorFraction,
          offS: final.offS,
          contractions: final.contractions,
          aTargetPctMvc: plan.aTargetPctMvc,
          validityH: final.validityH,
          referenceMvc:
            final.referenceMvc === plan.referenceMvc.value
              ? plan.referenceMvc
              : { value: final.referenceMvc, unit: plan.referenceMvc.unit, recordedAt: now.toISOString(), recordedBy: practitionerId },
        },
        decisions: PLAN_PARAMETERS.map((p) => {
          const c = draft.choices[p]
          return c.action === 'override' ? { parameter: p, action: 'override' as const, reason: c.reason.trim() } : { parameter: p, action: 'accept' as const, reason: null }
        }),
      }
    : null
  return { errors, decided, complete, final, warnings, request }
}
