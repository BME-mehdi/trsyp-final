import { Instant, OpaqueId } from '@symbiomed/domain'
import type { AuditEvent } from 'fhir/r4'
import { z } from 'zod'
import { asResource } from './ext'
import { AUDIT_EVENT_TYPE, RESTFUL_INTERACTION } from './terminology'

const TYPES = 'Patient|Practitioner|CarePlan|Procedure|Observation|Provenance|AdverseEvent|Device|Consent'
const IdRef = (types: string) => z.string().regex(new RegExp(`^(${types})/[A-Za-z0-9\\-.]{1,64}(/_history/\\d+)?$`))

/** What the BFF records for every read and write of patient data. References only: IDs, never free text. */
export const AuditRecordSchema = z.object({
  auditId: OpaqueId,
  interaction: z.enum(['create', 'read', 'update', 'delete', 'search-type']),
  recorded: Instant,
  outcome: z.enum(['0', '4', '8', '12']), // FHIR audit-event-outcome: success, minor, serious, major failure
  agent: IdRef('Patient|Practitioner'),
  entities: z.array(IdRef(TYPES)).min(1),
})
export type AuditRecord = z.infer<typeof AuditRecordSchema>

const ACTION = { create: 'C', read: 'R', update: 'U', delete: 'D', 'search-type': 'E' } as const

export function auditToAuditEvent(a: AuditRecord): AuditEvent {
  return {
    resourceType: 'AuditEvent',
    id: a.auditId,
    type: { system: AUDIT_EVENT_TYPE, code: 'rest' },
    subtype: [{ system: RESTFUL_INTERACTION, code: a.interaction }],
    action: ACTION[a.interaction],
    recorded: a.recorded,
    outcome: a.outcome,
    agent: [{ who: { reference: a.agent }, requestor: true }],
    source: { observer: { display: 'symbiomed-bff' } },
    entity: a.entities.map((reference) => ({ what: { reference } })),
  }
}

export function auditEventToRecord(input: unknown): AuditRecord {
  const e = asResource(input, 'AuditEvent')
  return AuditRecordSchema.parse({
    auditId: e.id,
    interaction: e.subtype?.find((s) => s.system === RESTFUL_INTERACTION)?.code,
    recorded: e.recorded,
    outcome: e.outcome,
    agent: e.agent[0]?.who?.reference,
    entities: e.entity?.map((x) => x.what?.reference),
  })
}
