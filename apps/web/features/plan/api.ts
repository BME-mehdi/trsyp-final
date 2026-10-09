import { ApproveRequestSchema } from '@symbiomed/api-client'
import { ParameterDecisionSchema, PLAN_PARAMETERS, nextVersionOk, referenceMvcUpdateOk, validatePlan, type ParameterDecision } from '@symbiomed/domain'
import { carePlanToPlan, decisionToProvenance, planToCarePlan, suggestionToCarePlan } from '@symbiomed/fhir'
import type { CarePlan } from 'fhir/r4'
import { randomUUID } from 'node:crypto'
import { auditEntry, auditRead } from '../../server/audit'
import { requireStepUp } from '../../server/auth'
import { HttpError, issuesOf } from '../../server/errors'
import { fhir, put, versionOf } from '../../server/fhir'
import { currentPlan, pendingSuggestion } from '../../server/records'
import { body, patientRoute } from '../../server/route'

const HOUR_MS = 3_600_000

export const getPlan = patientRoute(['clinician', 'patient'], async ({ principal, patientId }) => {
  const plan = await currentPlan(patientId)
  await auditRead(principal, 'search-type', [`Patient/${patientId}`, ...(plan ? [`CarePlan/${plan.planId}/_history/${plan.version}`] : [])])
  return { plan }
})

/** Every approved version of the patient's plan, oldest first (charts: approved ceiling per session). */
export const getPlanHistory = patientRoute(['clinician'], async ({ principal, patientId }) => {
  const current = await currentPlan(patientId)
  const plans = current ? (await fhir.history<CarePlan>('CarePlan', current.planId)).map((cp) => carePlanToPlan(cp)).sort((a, b) => a.version - b.version) : []
  await auditRead(principal, 'read', [`Patient/${patientId}`, ...(current ? [`CarePlan/${current.planId}`] : [])])
  return { plans }
})

/**
 * Approve the next plan version. Checks run on the server whatever the UI did:
 * step-up, the pending suggestion, every decision, version monotonicity, the reference MVC
 * rule and the plan limits (@symbiomed/domain). Then one FHIR transaction writes the active
 * CarePlan, the suggestion's new status, one Provenance per parameter and the AuditEvent.
 */
export const approvePlan = patientRoute(['clinician'], async ({ req, principal, patientId }) => {
  requireStepUp(principal)
  const input = await body(req, ApproveRequestSchema)
  const [current, pending] = await Promise.all([currentPlan(patientId), pendingSuggestion(patientId)])
  if (!pending || pending.suggestion.suggestionId !== input.suggestionId) {
    throw new HttpError(409, 'conflict', 'This suggestion is no longer waiting for approval')
  }

  if (!nextVersionOk(current?.version ?? null, input.version)) {
    throw new HttpError(409, 'version_not_newer', `Plan version must be higher than ${current?.version ?? 0}`)
  }
  if (input.version !== (current?.version ?? 0) + 1) throw new HttpError(409, 'version_gap', `The next plan version is ${(current?.version ?? 0) + 1}`)
  if (!referenceMvcUpdateOk(current?.referenceMvc ?? null, input.plan.referenceMvc)) {
    throw new HttpError(422, 'reference_mvc_lowered', 'The reference MVC may only be raised by a newer recording')
  }

  const now = new Date()
  const { validityH, ...values } = input.plan
  const checked = validatePlan({
    planId: current?.planId ?? randomUUID(),
    patientId,
    version: input.version,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + validityH * HOUR_MS).toISOString(),
    ...values,
    approvedBy: principal.practitionerId,
    approvedAt: now.toISOString(),
  })
  if (!checked.success) throw new HttpError(422, 'plan_invalid', 'The plan is outside the limits', { issues: issuesOf(checked.error) })
  const plan = checked.data

  const s = pending.suggestion
  if (new Set(input.decisions.map((d) => d.parameter)).size !== PLAN_PARAMETERS.length) {
    throw new HttpError(422, 'decision_invalid', 'Each parameter needs exactly one decision')
  }
  const decisions: ParameterDecision[] = input.decisions.map((d) => {
    const r = ParameterDecisionSchema.safeParse({
      decisionId: randomUUID(),
      suggestionId: s.suggestionId,
      planId: plan.planId,
      planVersion: plan.version,
      parameter: d.parameter,
      suggestedValue: s[d.parameter].value,
      approvedValue: plan[d.parameter],
      action: d.action,
      reason: d.reason,
      decidedBy: principal.practitionerId,
      decidedAt: plan.approvedAt,
    })
    if (!r.success) throw new HttpError(422, 'decision_invalid', `Decision on ${d.parameter} is not consistent`, { issues: issuesOf(r.error) })
    return r.data
  })

  const planRef = `CarePlan/${plan.planId}/_history/${plan.version}`
  const result = await fhir.transaction([
    put(planToCarePlan(plan), current?.version),
    put(suggestionToCarePlan(s, 'completed'), pending.versionId),
    ...decisions.map((d) => put(decisionToProvenance(d))),
    auditEntry(principal, current ? 'update' : 'create', [`Patient/${patientId}`, planRef, ...decisions.map((d) => `Provenance/${d.decisionId}`)]),
  ])
  if (versionOf(result.entry?.[0]) !== plan.version) {
    // The server numbers versions; a mismatch means the CarePlan was edited outside an approval.
    console.error('bff: plan version mismatch after approval')
  }
  return { plan, decisions }
})
