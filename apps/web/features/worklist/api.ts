import type { WorklistRow } from '@symbiomed/api-client'
import { isPlanExpired, safetyEvents } from '@symbiomed/domain'
import { BASE } from '@symbiomed/fhir'
import type { Patient } from 'fhir/r4'
import { auditRead } from '../../server/audit'
import { fhir } from '../../server/fhir'
import { currentPlan, pendingSuggestion, sessionsOf } from '../../server/records'
import { apiRoute } from '../../server/route'

const order = (r: WorklistRow) => (r.pendingSuggestion ? 0 : r.plan?.status === 'expired' || !r.plan ? 1 : 2)

/** Clinician worklist: pending approvals first, then expired or missing plans, then the rest. */
export const getWorklist = apiRoute(['clinician'], async ({ principal }) => {
  const patients = await fhir.search<Patient>('Patient', {})
  const now = new Date()
  const rows = await Promise.all(
    patients.map(async (p): Promise<WorklistRow> => {
      const id = p.id as string
      const [plan, pending, sessions] = await Promise.all([currentPlan(id), pendingSuggestion(id), sessionsOf(id)])
      return {
        patientId: id,
        label: p.identifier?.find((i) => i.system === `${BASE}/sid/study`)?.value ?? id,
        plan: plan && { version: plan.version, status: isPlanExpired(plan, now) ? 'expired' : 'active', expiresAt: plan.expiresAt, ceilingMa: plan.ceilingMa },
        pendingSuggestion: pending !== null,
        lastSessionAt: sessions.at(-1)?.startedAt ?? null,
        safetyEventsSinceApproval: safetyEvents(sessions.filter((s) => plan && s.planId === plan.planId && s.planVersion === plan.version)).length,
      }
    }),
  )
  await auditRead(principal, 'search-type', rows.map((r) => `Patient/${r.patientId}`))
  return { patients: rows.sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label)) }
})
