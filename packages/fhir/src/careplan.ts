import { AiSuggestionSchema, LIMITS, PLAN_PARAMETERS, PlanSchema, type AiSuggestion, type Plan, type PlanParameter } from '@symbiomed/domain'
import type { CarePlan, Extension } from 'fhir/r4'
import { codeOf, coding } from './codesystems'
import { asResource, ext, getExt, getExts, ref, refId, sub } from './ext'
import { quantity, valueIn } from './terminology'

const aiParameter = (parameter: PlanParameter, v: AiSuggestion[PlanParameter]): Extension =>
  ext('ai-parameter', {
    extension: [
      { url: 'parameter', valueCoding: coding('plan-parameter', parameter) },
      { url: 'value', valueDecimal: v.value },
      ...v.reasons.map((r) => ({
        url: 'reason',
        extension: [
          { url: 'feature', valueString: r.feature },
          { url: 'text', valueString: r.text },
          { url: 'contribution', valueDecimal: r.contribution },
        ],
      })),
      { url: 'clamped', valueBoolean: v.clamped },
      ...(v.clampReason ? [{ url: 'clamp-reason', valueCoding: coding('clamp-reason', v.clampReason) }] : []),
    ],
  })

const readAiParameter = (e: Extension) => ({
  value: sub(e, 'value')?.valueDecimal,
  reasons: (e.extension ?? [])
    .filter((s) => s.url === 'reason')
    .map((r) => ({
      feature: sub(r, 'feature')?.valueString,
      text: sub(r, 'text')?.valueString,
      contribution: sub(r, 'contribution')?.valueDecimal,
    })),
  clamped: sub(e, 'clamped')?.valueBoolean,
  clampReason: codeOf(sub(e, 'clamp-reason')?.valueCoding, 'clamp-reason') ?? null,
})

/** Draft = pending review; completed = approved into a plan; revoked = rejected or superseded. */
export type SuggestionStatus = 'draft' | 'completed' | 'revoked'

/** AI suggestion -> CarePlan with intent proposal. It is never an approved plan (intent order). */
export function suggestionToCarePlan(s: AiSuggestion, status: SuggestionStatus = 'draft'): CarePlan {
  return {
    resourceType: 'CarePlan',
    id: s.suggestionId,
    status,
    intent: 'proposal',
    subject: ref('Patient', s.patientId),
    supportingInfo: [ref('Procedure', s.basedOnSessionId)],
    extension: [
      ext('data-basis', { valueCoding: coding('data-basis', s.dataBasis) }),
      ...PLAN_PARAMETERS.map((p) => aiParameter(p, s[p])),
    ],
  }
}

export function carePlanToSuggestion(input: unknown): AiSuggestion {
  const cp = asResource(input, 'CarePlan')
  if (cp.intent !== 'proposal' || cp.status === 'active') throw new Error('only a proposal CarePlan holds an AI suggestion')
  const params = Object.fromEntries(
    getExts(cp.extension, 'ai-parameter').map((e) => [codeOf(sub(e, 'parameter')?.valueCoding, 'plan-parameter'), readAiParameter(e)]),
  )
  return AiSuggestionSchema.parse({
    suggestionId: cp.id,
    patientId: refId(cp.subject, 'Patient'),
    basedOnSessionId: refId(cp.supportingInfo?.[0], 'Procedure'),
    ceilingMa: params.ceilingMa,
    offS: params.offS,
    contractions: params.contractions,
    dataBasis: codeOf(getExt(cp.extension, 'data-basis')?.valueCoding, 'data-basis'),
  })
}

/** Approved plan -> CarePlan (status active). meta.versionId carries the plan version. */
export function planToCarePlan(p: Plan): CarePlan {
  return {
    resourceType: 'CarePlan',
    id: p.planId,
    meta: { versionId: String(p.version) },
    status: 'active',
    intent: 'order',
    subject: ref('Patient', p.patientId),
    period: { start: p.issuedAt, end: p.expiresAt },
    created: p.approvedAt,
    author: ref('Practitioner', p.approvedBy),
    activity: [
      {
        detail: {
          code: { coding: [coding('activity', 'nmes-session')] },
          status: 'scheduled',
          scheduledTiming: { repeat: { frequency: LIMITS.sessionsPerDay, period: 1, periodUnit: 'd' } },
          extension: [
            ext('pulse-width', { valueQuantity: quantity(p.pulseWidthUs, 'us') }),
            ext('ceiling', { valueQuantity: quantity(p.ceilingMa, 'mA') }),
            ext('floor-fraction', { valueDecimal: p.floorFraction }),
            ext('off-time', { valueQuantity: quantity(p.offS, 's') }),
            ext('contractions', { valueInteger: p.contractions }),
            ext('a-target', { valueQuantity: quantity(p.aTargetPctMvc, '%') }),
            ext('reference-mvc', {
              extension: [
                { url: 'value', valueQuantity: quantity(p.referenceMvc.value, p.referenceMvc.unit) },
                { url: 'recorded-at', valueDateTime: p.referenceMvc.recordedAt },
                { url: 'recorded-by', valueReference: ref('Practitioner', p.referenceMvc.recordedBy) },
              ],
            }),
          ],
        },
      },
    ],
  }
}

export function carePlanToPlan(input: unknown): Plan {
  const cp = asResource(input, 'CarePlan')
  if (cp.status !== 'active' || cp.intent !== 'order') throw new Error('only an active order CarePlan holds an approved plan')
  const x = cp.activity?.[0]?.detail?.extension
  const mvc = getExt(x, 'reference-mvc')
  const unit = LIMITS.referenceMvcUnit
  return PlanSchema.parse({
    planId: cp.id,
    patientId: refId(cp.subject, 'Patient'),
    version: Number(cp.meta?.versionId),
    issuedAt: cp.period?.start,
    expiresAt: cp.period?.end,
    pulseWidthUs: valueIn(getExt(x, 'pulse-width')?.valueQuantity, 'us'),
    ceilingMa: valueIn(getExt(x, 'ceiling')?.valueQuantity, 'mA'),
    floorFraction: getExt(x, 'floor-fraction')?.valueDecimal,
    offS: valueIn(getExt(x, 'off-time')?.valueQuantity, 's'),
    contractions: getExt(x, 'contractions')?.valueInteger,
    aTargetPctMvc: valueIn(getExt(x, 'a-target')?.valueQuantity, '%'),
    referenceMvc: {
      value: valueIn(sub(mvc, 'value')?.valueQuantity, unit),
      unit,
      recordedAt: sub(mvc, 'recorded-at')?.valueDateTime,
      recordedBy: refId(sub(mvc, 'recorded-by')?.valueReference, 'Practitioner'),
    },
    approvedBy: refId(cp.author, 'Practitioner'),
    approvedAt: cp.created,
  })
}
