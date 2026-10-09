import { SessionSummarySchema, type SessionSummary } from '@symbiomed/domain'
import type { AdverseEvent, Coding, Observation, Procedure, Quantity } from 'fhir/r4'
import { OBSERVATION_CODES, codeIn, codeOf, coding } from './codesystems'
import { asResource, ext, getExt, getExts, ref, refId, sub, versionedRef, versionedRefParts } from './ext'
import { OBSERVATION_CATEGORY, PAIN_LOINC, quantity, valueIn, type Unit } from './terminology'

export type SessionResources = { procedure: Procedure; observations: Observation[]; adverseEvent: AdverseEvent | null }

const observation = (s: SessionSummary, key: string, code: Coding, category: 'survey' | 'procedure', value: Quantity): Observation => ({
  resourceType: 'Observation',
  id: `${s.sessionId}-${key}`, // deterministic: a re-sent session updates, never duplicates
  status: 'final',
  category: [{ coding: [{ system: OBSERVATION_CATEGORY, code: category }] }],
  code: { coding: [code] },
  subject: ref('Patient', s.patientId),
  partOf: [ref('Procedure', s.sessionId)],
  effectiveDateTime: s.endedAt,
  valueQuantity: value,
})

const mean = (xs: number[]) => Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10

/**
 * Session summary -> Procedure + Observations (+ AdverseEvent when the brace stopped the session).
 * `deviceId` is the brace the backend has on record for the patient.
 */
export function sessionToFhir(s: SessionSummary, opts: { deviceId?: string } = {}): SessionResources {
  const local = (key: string) => coding('observation', key)
  const observations = [
    s.pain === null ? null : observation(s, 'pain', PAIN_LOINC, 'survey', quantity(s.pain, '{score}')),
    s.comfort === null ? null : observation(s, 'comfort', local(OBSERVATION_CODES.comfort), 'survey', quantity(s.comfort, '{score}')),
    observation(s, 'flexion', local(OBSERVATION_CODES.flexion), 'procedure', quantity(s.flexionMaxDeg, 'deg')),
    // Session-level activation for charts: mean A_v. Derived, so the parser reads the per-contraction rows instead.
    s.perContraction.length === 0 ? null
      : observation(s, 'activation', local(OBSERVATION_CODES.activation), 'procedure', quantity(mean(s.perContraction.map((c) => c.aV)), '%')),
    s.fatigueMdfDropPct === null ? null
      : observation(s, 'fatigue', local(OBSERVATION_CODES.fatigue), 'procedure', quantity(s.fatigueMdfDropPct, '%')),
    observation(s, 'peak-current', local(OBSERVATION_CODES.peakCurrent), 'procedure', quantity(s.peakDeliveredMa, 'mA')),
  ].filter((o): o is Observation => o !== null)

  const procedure: Procedure = {
    resourceType: 'Procedure',
    id: s.sessionId,
    status: s.safeStopCause ? 'stopped' : 'completed',
    code: { coding: [coding('activity', 'nmes-session')] },
    subject: ref('Patient', s.patientId),
    basedOn: [versionedRef('CarePlan', s.planId, s.planVersion)],
    performedPeriod: { start: s.startedAt, end: s.endedAt },
    ...(opts.deviceId ? { usedReference: [ref('Device', opts.deviceId)] } : {}),
    extension: [
      ext('plan-version', { valueInteger: s.planVersion }), // survives servers that strip reference versions
      ext('firmware-version', { valueString: s.firmwareVersion }),
      ext('mode', { valueInteger: s.mode }),
      ext('degraded', { valueBoolean: s.degraded }),
      ext('contractions-done', { valueInteger: s.contractionsDone }),
      ext('mean-delivered-current', { valueQuantity: quantity(s.meanDeliveredMa, 'mA') }),
      ...s.perContraction.map((c) =>
        ext('contraction', {
          extension: [
            { url: 'index', valueInteger: c.index },
            { url: 'voluntary-activation', valueQuantity: quantity(c.aV, '%') },
            { url: 'commanded-current', valueQuantity: quantity(c.commandedMa, 'mA') },
            { url: 'peak-current', valueQuantity: quantity(c.peakMa, 'mA') },
            { url: 'model-a-label', valueCoding: coding('model-a-label', c.modelALabel) },
          ],
        }),
      ),
    ],
  }

  const adverseEvent: AdverseEvent | null = s.safeStopCause === null ? null : {
    resourceType: 'AdverseEvent',
    id: `${s.sessionId}-stop`,
    actuality: 'potential', // a brace stop; harm is not known from device data (see OPEN_QUESTIONS.md)
    event: { coding: [coding('stop-cause', s.safeStopCause)] },
    subject: ref('Patient', s.patientId),
    date: s.endedAt,
    suspectEntity: [{ instance: ref('Procedure', s.sessionId) }],
  }

  return { procedure, observations, adverseEvent }
}

export function sessionFromFhir(r: { procedure: unknown; observations: unknown[]; adverseEvent?: unknown }): SessionSummary {
  const p = asResource(r.procedure, 'Procedure')
  const self = `Procedure/${p.id}`
  const obs = r.observations.map((o) => asResource(o, 'Observation')).filter((o) => o.partOf?.some((x) => x.reference === self))
  const local = (key: string) => coding('observation', key)
  // null when the observation is absent; undefined (rejected below) when it is there with a wrong unit.
  const value = (c: Coding, unit: Unit) => {
    const o = obs.find((o) => o.code.coding?.some((x) => x.system === c.system && x.code === c.code))
    return o ? valueIn(o.valueQuantity, unit) : null
  }
  const ae = r.adverseEvent ? asResource(r.adverseEvent, 'AdverseEvent') : null
  if (ae && ae.suspectEntity?.[0]?.instance.reference !== self) throw new Error('AdverseEvent belongs to another session')
  const plan = versionedRefParts(p.basedOn?.[0], 'CarePlan')
  const x = p.extension

  return SessionSummarySchema.parse({
    sessionId: p.id,
    patientId: refId(p.subject, 'Patient'),
    planId: plan.id,
    planVersion: getExt(x, 'plan-version')?.valueInteger ?? plan.version,
    firmwareVersion: getExt(x, 'firmware-version')?.valueString,
    startedAt: p.performedPeriod?.start,
    endedAt: p.performedPeriod?.end,
    mode: getExt(x, 'mode')?.valueInteger,
    degraded: getExt(x, 'degraded')?.valueBoolean,
    contractionsDone: getExt(x, 'contractions-done')?.valueInteger,
    peakDeliveredMa: value(local(OBSERVATION_CODES.peakCurrent), 'mA'),
    meanDeliveredMa: valueIn(getExt(x, 'mean-delivered-current')?.valueQuantity, 'mA'),
    perContraction: getExts(x, 'contraction').map((c) => ({
      index: sub(c, 'index')?.valueInteger,
      aV: valueIn(sub(c, 'voluntary-activation')?.valueQuantity, '%'),
      commandedMa: valueIn(sub(c, 'commanded-current')?.valueQuantity, 'mA'),
      peakMa: valueIn(sub(c, 'peak-current')?.valueQuantity, 'mA'),
      modelALabel: codeOf(sub(c, 'model-a-label')?.valueCoding, 'model-a-label'),
    })),
    fatigueMdfDropPct: value(local(OBSERVATION_CODES.fatigue), '%'),
    flexionMaxDeg: value(local(OBSERVATION_CODES.flexion), 'deg'),
    safeStopCause: ae ? codeIn(ae.event?.coding, 'stop-cause') : null,
    comfort: value(local(OBSERVATION_CODES.comfort), '{score}'),
    pain: value(PAIN_LOINC, '{score}'),
  })
}
