import { auditEventToRecord } from '@symbiomed/fhir'
import type { AuditEvent } from 'fhir/r4'
import { auditRead } from '../../server/audit'
import { fhir } from '../../server/fhir'
import { patientRoute } from '../../server/route'

const SHOWN = 100

/** The latest audit entries that touch this patient (IDs only), newest first. */
export const getAudit = patientRoute(['clinician'], async ({ principal, patientId }) => {
  const found = await fhir.searchPage<AuditEvent>('AuditEvent', { entity: `Patient/${patientId}`, _sort: '-date', _count: String(SHOWN) })
  const events = found.map((e) => auditEventToRecord(e)).sort((a, b) => b.recorded.localeCompare(a.recorded)).slice(0, SHOWN)
  await auditRead(principal, 'search-type', [`Patient/${patientId}`])
  return { events }
})
