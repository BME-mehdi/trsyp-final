import { ParameterDecisionSchema, type ParameterDecision } from '@symbiomed/domain'
import type { Provenance } from 'fhir/r4'
import { codeIn, codeOf, coding } from './codesystems'
import { asResource, ext, getExt, ref, refId, versionedRef, versionedRefParts } from './ext'

/**
 * One clinician decision on one parameter -> Provenance. The target is the exact plan version
 * the decision produced; the entity is the AI suggestion it was derived from.
 */
export function decisionToProvenance(d: ParameterDecision): Provenance {
  return {
    resourceType: 'Provenance',
    id: d.decisionId,
    target: [versionedRef('CarePlan', d.planId, d.planVersion)],
    recorded: d.decidedAt,
    agent: [{ who: ref('Practitioner', d.decidedBy) }],
    activity: { coding: [coding('decision', d.action)] },
    ...(d.reason === null ? {} : { reason: [{ text: d.reason }] }),
    entity: [{ role: 'derivation', what: ref('CarePlan', d.suggestionId) }],
    extension: [
      ext('plan-version', { valueInteger: d.planVersion }), // survives servers that strip reference versions
      ext('plan-parameter', { valueCoding: coding('plan-parameter', d.parameter) }),
      ext('suggested-value', { valueDecimal: d.suggestedValue }),
      ext('approved-value', { valueDecimal: d.approvedValue }),
    ],
  }
}

export function provenanceToDecision(input: unknown): ParameterDecision {
  const p = asResource(input, 'Provenance')
  const target = versionedRefParts(p.target[0], 'CarePlan')
  return ParameterDecisionSchema.parse({
    decisionId: p.id,
    suggestionId: refId(p.entity?.find((e) => e.role === 'derivation')?.what, 'CarePlan'),
    planId: target.id,
    planVersion: getExt(p.extension, 'plan-version')?.valueInteger ?? target.version,
    parameter: codeOf(getExt(p.extension, 'plan-parameter')?.valueCoding, 'plan-parameter'),
    suggestedValue: getExt(p.extension, 'suggested-value')?.valueDecimal,
    approvedValue: getExt(p.extension, 'approved-value')?.valueDecimal,
    action: codeIn(p.activity?.coding, 'decision'),
    reason: p.reason?.[0]?.text ?? null,
    decidedBy: refId(p.agent[0]?.who, 'Practitioner'),
    decidedAt: p.recorded,
  })
}
