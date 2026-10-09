import { auditToAuditEvent, type AuditRecord } from '@symbiomed/fhir'
import type { AuditEvent } from 'fhir/r4'
import { randomUUID } from 'node:crypto'
import type { Principal } from './auth'
import { HttpError } from './errors'
import { fhir, put } from './fhir'

export const agentRef = (p: Principal) => (p.role === 'patient' ? `Patient/${p.patientId}` : `Practitioner/${p.practitionerId}`)

/** IDs only (CLAUDE.md): the record holds references, never names or values. */
export const auditEvent = (p: Principal, interaction: AuditRecord['interaction'], entities: string[], outcome: AuditRecord['outcome'] = '0'): AuditEvent =>
  auditToAuditEvent({ auditId: randomUUID(), interaction, recorded: new Date().toISOString(), outcome, agent: agentRef(p), entities })

/** For a write: the AuditEvent goes into the same transaction as the data. */
export const auditEntry = (...args: Parameters<typeof auditEvent>) => put(auditEvent(...args))

/** For a read: written before the data is returned. If the audit cannot be written, the read fails. */
export async function auditRead(...args: Parameters<typeof auditEvent>) {
  if (!(await fhir.create(auditEvent(...args)))) throw new HttpError(503, 'upstream_unavailable', 'Audit trail unavailable')
}

/** Denied access is recorded too (outcome 4), best effort: the denial stands even if this write fails. */
export async function auditDenied(p: Principal, entities: string[]) {
  if (p.role === 'admin') return // no FHIR identity to record as agent
  await fhir.create(auditEvent(p, 'read', entities, '4')).catch(() => undefined)
}
