import { ParameterDecisionSchema } from '@symbiomed/domain'
import { carePlanToPlan, carePlanToSuggestion, decisionToProvenance, provenanceToDecision } from '@symbiomed/fhir'
import type { CarePlan, Provenance } from 'fhir/r4'
import { auditEntry, auditRead } from '../../server/audit'
import { HttpError } from '../../server/errors'
import { fhir, put } from '../../server/fhir'
import { currentPlan } from '../../server/records'
import { body, patientRoute } from '../../server/route'

/** Decision log: every accept or override on this patient's plan, newest first. */
export const getDecisions = patientRoute(['clinician'], async ({ principal, patientId }) => {
  const plan = await currentPlan(patientId)
  const found = plan ? await fhir.search<Provenance>('Provenance', { target: `CarePlan/${plan.planId}` }) : []
  const decisions = found.map((p) => provenanceToDecision(p)).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt) || a.parameter.localeCompare(b.parameter))
  await auditRead(principal, 'search-type', [`Patient/${patientId}`])
  return { decisions }
})

/**
 * Records one decision against a plan version that already exists (for example a decision
 * captured separately). The usual path is POST .../plan/approve, which writes the three decisions
 * in the same transaction as the plan. Values must match both the suggestion and the plan.
 */
export const postDecision = patientRoute(['clinician'], async ({ req, principal, patientId }) => {
  const d = await body(req, ParameterDecisionSchema)
  if (d.decidedBy !== principal.practitionerId) throw new HttpError(403, 'forbidden', 'A clinician records only their own decisions')
  const [planCp, suggestionCp] = await Promise.all([
    fhir.vread<CarePlan>('CarePlan', d.planId, d.planVersion),
    fhir.read<CarePlan>('CarePlan', d.suggestionId),
  ])
  if (!planCp || !suggestionCp) throw new HttpError(404, 'not_found', 'Plan version or suggestion not found')
  const plan = carePlanToPlan(planCp)
  const suggestion = carePlanToSuggestion(suggestionCp)
  if (plan.patientId !== patientId || suggestion.patientId !== patientId) throw new HttpError(404, 'not_found', 'Plan version or suggestion not found')
  if (suggestion[d.parameter].value !== d.suggestedValue || plan[d.parameter] !== d.approvedValue) {
    throw new HttpError(422, 'decision_invalid', 'Decision values do not match the suggestion and the plan')
  }
  await fhir.transaction([
    put(decisionToProvenance(d)),
    auditEntry(principal, 'create', [`Patient/${patientId}`, `Provenance/${d.decisionId}`, `CarePlan/${d.planId}/_history/${d.planVersion}`]),
  ])
  return { decision: d }
})
