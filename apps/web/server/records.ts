import type { Plan } from '@symbiomed/domain'
import { carePlanToPlan, carePlanToSuggestion, sessionFromFhir } from '@symbiomed/fhir'
import type { AdverseEvent, CarePlan, Observation, Procedure } from 'fhir/r4'
import { fhir } from './fhir'

// Reads shared by the routes. Every parse goes through @symbiomed/fhir, which validates with the domain schemas.

export async function currentPlan(patientId: string): Promise<Plan | null> {
  const [cp, ...more] = await fhir.search<CarePlan>('CarePlan', { subject: `Patient/${patientId}`, status: 'active', intent: 'order' })
  if (more.length) throw new Error('more than one active plan for a patient')
  return cp ? carePlanToPlan(cp) : null
}

/** The suggestion waiting for review (status draft). There is at most one per patient. */
export async function pendingSuggestion(patientId: string) {
  const [cp] = await fhir.search<CarePlan>('CarePlan', { subject: `Patient/${patientId}`, status: 'draft', intent: 'proposal' })
  return cp ? { suggestion: carePlanToSuggestion(cp), versionId: Number(cp.meta?.versionId) } : null
}

/** One session, or null when it does not exist or belongs to someone else. */
export async function sessionOf(patientId: string, sessionId: string) {
  const procedure = await fhir.read<Procedure>('Procedure', sessionId)
  if (!procedure || procedure.subject.reference !== `Patient/${patientId}`) return null
  const [observations, adverse] = await Promise.all([
    fhir.search<Observation>('Observation', { 'part-of': `Procedure/${sessionId}` }),
    fhir.search<AdverseEvent>('AdverseEvent', { subject: `Patient/${patientId}` }),
  ])
  return sessionFromFhir({ procedure, observations, adverseEvent: adverse.find((a) => a.suspectEntity?.[0]?.instance.reference === `Procedure/${sessionId}`) })
}

export async function sessionsOf(patientId: string) {
  const subject = `Patient/${patientId}`
  const [procedures, observations, adverse] = await Promise.all([
    fhir.search<Procedure>('Procedure', { subject }),
    fhir.search<Observation>('Observation', { subject }),
    fhir.search<AdverseEvent>('AdverseEvent', { subject }),
  ])
  return procedures
    .map((procedure) => {
      const self = `Procedure/${procedure.id}`
      return sessionFromFhir({
        procedure,
        observations: observations.filter((o) => o.partOf?.some((r) => r.reference === self)),
        adverseEvent: adverse.find((a) => a.suspectEntity?.[0]?.instance.reference === self),
      })
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}
