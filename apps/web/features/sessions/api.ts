import { OutcomeRequestSchema } from '@symbiomed/api-client'
import { SessionSummarySchema } from '@symbiomed/domain'
import { carePlanToPlan, sessionToFhir } from '@symbiomed/fhir'
import type { CarePlan, Device } from 'fhir/r4'
import { auditEntry, auditRead } from '../../server/audit'
import { HttpError } from '../../server/errors'
import { fhir, put } from '../../server/fhir'
import { sessionOf, sessionsOf } from '../../server/records'
import { body, patientRoute } from '../../server/route'

export const getSessions = patientRoute(['clinician', 'patient'], async ({ principal, patientId }) => {
  const sessions = await sessionsOf(patientId)
  await auditRead(principal, 'search-type', [`Patient/${patientId}`])
  return { sessions }
})

/**
 * Upload of a session summary from the app (brace -> app -> BFF). Idempotent: resource ids
 * derive from the session id, so a retried upload updates instead of duplicating. A commanded
 * plateau above 50 mA is refused by the schema (spec IX.3).
 */
export const postSession = patientRoute(['patient', 'clinician'], async ({ req, principal, patientId }) => {
  const s = await body(req, SessionSummarySchema)
  if (s.patientId !== patientId) throw new HttpError(403, 'forbidden', 'Session belongs to another patient')
  const planCp = await fhir.vread<CarePlan>('CarePlan', s.planId, s.planVersion)
  if (!planCp || carePlanToPlan(planCp).patientId !== patientId) throw new HttpError(422, 'plan_invalid', 'Session refers to an unknown plan version')
  const [device] = await fhir.search<Device>('Device', { patient: `Patient/${patientId}` })
  const r = sessionToFhir(s, { deviceId: device?.id })
  await fhir.transaction([
    put(r.procedure),
    ...r.observations.map((o) => put(o)),
    ...(r.adverseEvent ? [put(r.adverseEvent)] : []),
    auditEntry(principal, 'update', [`Patient/${patientId}`, `Procedure/${s.sessionId}`]),
  ])
  return { session: s }
})

/** Patient-entered comfort (0–3) and pain (0–10) for one of their own sessions. */
export const postOutcome = patientRoute(['patient'], async ({ req, principal, patientId }) => {
  const o = await body(req, OutcomeRequestSchema)
  const session = await sessionOf(patientId, o.sessionId)
  if (!session) throw new HttpError(404, 'not_found', 'Session not found')
  const updated = { ...session, comfort: o.comfort, pain: o.pain }
  const obs = sessionToFhir(updated).observations
    .filter((x) => x.id === `${o.sessionId}-pain` || x.id === `${o.sessionId}-comfort`)
    .map((x) => (o.note && x.id === `${o.sessionId}-comfort` ? { ...x, note: [{ text: o.note }] } : x))
  await fhir.transaction([...obs.map((x) => put(x)), auditEntry(principal, 'update', [`Patient/${patientId}`, `Procedure/${o.sessionId}`])])
  return { session: updated }
})
