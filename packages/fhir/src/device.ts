import { BraceSchema, type Brace } from '@symbiomed/domain'
import type { Device } from 'fhir/r4'
import { asResource, ref, refId } from './ext'
import { SERIAL_SYSTEM } from './terminology'

/** The brace -> Device: serial as identifier, firmware in `version`. */
export function braceToDevice(b: Brace): Device {
  return {
    resourceType: 'Device',
    id: b.braceId,
    status: 'active',
    identifier: [{ system: SERIAL_SYSTEM, value: b.serial }],
    version: [{ value: b.firmwareVersion }],
    ...(b.patientId ? { patient: ref('Patient', b.patientId) } : {}),
  }
}

export function deviceToBrace(input: unknown): Brace {
  const d = asResource(input, 'Device')
  return BraceSchema.parse({
    braceId: d.id,
    serial: d.identifier?.find((i) => i.system === SERIAL_SYSTEM)?.value,
    firmwareVersion: d.version?.[0]?.value,
    patientId: d.patient ? refId(d.patient, 'Patient') : null,
  })
}
