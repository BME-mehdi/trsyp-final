import type { Coding, Quantity } from 'fhir/r4'

export const BASE = 'https://symbiomed.example/fhir'
export const EXT = `${BASE}/StructureDefinition/`
export const SERIAL_SYSTEM = `${BASE}/sid/brace-serial`
export const UCUM = 'http://unitsofmeasure.org'
export const OBSERVATION_CATEGORY = 'http://terminology.hl7.org/CodeSystem/observation-category'
export const AUDIT_EVENT_TYPE = 'http://terminology.hl7.org/CodeSystem/audit-event-type'
export const RESTFUL_INTERACTION = 'http://hl7.org/fhir/restful-interaction'

/**
 * LOINC 72514-3, checked 2026-10-09 on NLM Clinical Tables and tx.fhir.org (LOINC 2.82, active).
 * The code says "verbal"; the app collects the rating on screen (fit noted in docs/TERMINOLOGY_TODO.md).
 */
export const PAIN_LOINC: Coding = {
  system: 'http://loinc.org',
  code: '72514-3',
  display: 'Pain severity - 0-10 verbal numeric rating [Score] - Reported',
}

/** UCUM codes used in this package (case-sensitive). */
export const UNITS = { score: '{score}', deg: 'deg', percent: '%', mA: 'mA', us: 'us', s: 's', mV: 'mV' } as const
export type Unit = (typeof UNITS)[keyof typeof UNITS]

export const quantity = (value: number, unit: Unit): Quantity => ({ value, unit, system: UCUM, code: unit })

/** The value of a UCUM quantity, or undefined when the unit is not the expected one. */
export const valueIn = (q: Quantity | undefined, unit: Unit): number | undefined =>
  q?.system === UCUM && q.code === unit ? q.value : undefined
