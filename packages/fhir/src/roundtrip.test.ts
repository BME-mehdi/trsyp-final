import * as fx from '@symbiomed/fixtures'
import type { Observation } from 'fhir/r4'
import { describe, expect, it } from 'vitest'
import {
  PAIN_LOINC,
  auditEventToRecord,
  auditToAuditEvent,
  braceToDevice,
  carePlanToPlan,
  carePlanToSuggestion,
  decisionToProvenance,
  deviceToBrace,
  planToCarePlan,
  provenanceToDecision,
  sessionFromFhir,
  sessionToFhir,
  suggestionToCarePlan,
  type AuditRecord,
} from './index'

// Everything crosses the network as JSON: round-trip through it, not through live objects.
const wire = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const deviceOf = new Map(fx.braces.map((b) => [b.patientId, b.braceId]))
const resourcesOf = (s: (typeof fx.sessions)[number]) => wire(sessionToFhir(s, { deviceId: deviceOf.get(s.patientId) }))
const audits: AuditRecord[] = [
  { auditId: 'ae-0001', interaction: 'read', recorded: '2026-02-17T09:00:00.000Z', outcome: '0', agent: 'Practitioner/pr-001', entities: ['Patient/pt-0a1b2c3d'] },
  { auditId: 'ae-0002', interaction: 'update', recorded: '2026-02-17T09:01:00.000Z', outcome: '0', agent: 'Practitioner/pr-002', entities: ['CarePlan/3f1d5c7e-8a2b-4c6d-9e0f-1a2b3c4d5e6f/_history/12'] },
  { auditId: 'ae-0003', interaction: 'search-type', recorded: '2026-02-17T09:02:00.000Z', outcome: '4', agent: 'Patient/pt-0a1b2c3d', entities: ['Patient/pt-0a1b2c3d', 'Observation/x-1'] },
]

describe('round trip: object -> FHIR -> object equals the original', () => {
  it(`every AI suggestion (${fx.suggestions.length}) via CarePlan draft`, () => {
    for (const s of fx.suggestions) expect(carePlanToSuggestion(wire(suggestionToCarePlan(s)))).toEqual(s)
  })
  it(`every approved plan (${fx.plans.length}) via CarePlan active`, () => {
    for (const p of fx.plans) expect(carePlanToPlan(wire(planToCarePlan(p)))).toEqual(p)
  })
  it(`every parameter decision (${fx.decisions.length}) via Provenance`, () => {
    for (const d of fx.decisions) expect(provenanceToDecision(wire(decisionToProvenance(d)))).toEqual(d)
  })
  it(`every session (${fx.sessions.length}) via Procedure, Observations and AdverseEvent`, () => {
    for (const s of fx.sessions) expect(sessionFromFhir(resourcesOf(s))).toEqual(s)
  })
  it('every brace via Device, assigned or not', () => {
    for (const b of [...fx.braces, { ...fx.braces[0]!, patientId: null }]) expect(deviceToBrace(wire(braceToDevice(b)))).toEqual(b)
  })
  it('audit records via AuditEvent', () => {
    for (const a of audits) expect(auditEventToRecord(wire(auditToAuditEvent(a)))).toEqual(a)
  })
})

describe('mapping rules', () => {
  const plan = fx.plans.at(-1)!
  const suggestion = fx.suggestions.at(-1)!

  it('keeps suggestions and approved plans apart', () => {
    const draft = suggestionToCarePlan(suggestion)
    const active = planToCarePlan(plan)
    expect([draft.status, draft.intent, active.status, active.intent]).toEqual(['draft', 'proposal', 'active', 'order'])
    expect(() => carePlanToPlan(draft)).toThrow()
    expect(() => carePlanToSuggestion(active)).toThrow()
  })

  it('maps the plan version, expiry and approver to standard elements', () => {
    const cp = planToCarePlan(plan)
    expect([cp.meta?.versionId, cp.period?.end, cp.author?.reference]).toEqual([String(plan.version), plan.expiresAt, `Practitioner/${plan.approvedBy}`])
  })

  it('points each Provenance at the exact plan version and the suggestion it came from', () => {
    const d = fx.decisions.at(-1)!
    const p = decisionToProvenance(d)
    expect(p.target[0]?.reference).toBe(`CarePlan/${d.planId}/_history/${d.planVersion}`)
    expect(p.entity?.[0]).toEqual({ role: 'derivation', what: { reference: `CarePlan/${d.suggestionId}` } })
  })

  it('codes pain with LOINC 72514-3 in {score}, and gives every observation a valid, deterministic id', () => {
    const s = fx.sessions.find((x) => x.pain !== null)!
    const { observations } = sessionToFhir(s)
    const pain = observations.find((o) => o.id === `${s.sessionId}-pain`)
    expect(pain?.code.coding?.[0]).toEqual(PAIN_LOINC)
    expect(pain?.valueQuantity).toEqual({ value: s.pain, unit: '{score}', system: 'http://unitsofmeasure.org', code: '{score}' })
    for (const o of observations) {
      expect(o.id).toMatch(/^[A-Za-z0-9\-.]{1,64}$/)
      expect(o.partOf?.[0]?.reference).toBe(`Procedure/${s.sessionId}`)
    }
  })

  it('keeps the plan version when a server strips versions from references (HAPI default)', () => {
    const strip = <T>(x: T): T => JSON.parse(JSON.stringify(x).replace(/\/_history\/\d+/g, '')) as T
    const d = fx.decisions.at(-1)!
    expect(provenanceToDecision(strip(decisionToProvenance(d)))).toEqual(d)
    const s = fx.sessions.at(-1)!
    expect(sessionFromFhir(strip(sessionToFhir(s)))).toEqual(s)
  })

  it('creates an AdverseEvent only when the brace stopped the session', () => {
    for (const s of fx.sessions) {
      const r = sessionToFhir(s)
      expect(r.adverseEvent !== null).toBe(s.safeStopCause !== null)
      expect(r.procedure.status).toBe(s.safeStopCause ? 'stopped' : 'completed')
    }
  })
})

describe('parsers refuse what does not fit the domain', () => {
  const plan = fx.plans.at(-1)!
  const session = fx.sessions.find((s) => s.pain !== null && s.safeStopCause === null)!

  it('refuses a plan outside the limits or in a wrong unit', () => {
    const over = wire(planToCarePlan(plan))
    over.activity![0]!.detail!.extension![1]!.valueQuantity!.value = 80
    expect(() => carePlanToPlan(over)).toThrow()
    const amps = wire(planToCarePlan(plan))
    amps.activity![0]!.detail!.extension![1]!.valueQuantity!.code = 'A'
    expect(() => carePlanToPlan(amps)).toThrow()
  })

  it('refuses a pain rating in a wrong unit instead of treating it as not entered', () => {
    const r = resourcesOf(session)
    const pain = r.observations.find((o) => o.id?.endsWith('-pain')) as Observation
    pain.valueQuantity = { ...pain.valueQuantity, code: '%' }
    expect(() => sessionFromFhir(r)).toThrow()
  })

  it("ignores another session's observations and refuses another session's AdverseEvent", () => {
    const other = fx.sessions.find((s) => s.safeStopCause !== null)!
    const mixed = resourcesOf(session)
    mixed.observations.push(...resourcesOf(other).observations)
    expect(sessionFromFhir(mixed)).toEqual(session)
    expect(() => sessionFromFhir({ ...mixed, adverseEvent: resourcesOf(other).adverseEvent })).toThrow()
  })

  it('refuses the wrong resource type and audit entries that are not plain ids', () => {
    expect(() => carePlanToPlan({ resourceType: 'Patient' })).toThrow(TypeError)
    expect(() => sessionFromFhir({ procedure: null, observations: [] })).toThrow(TypeError)
    for (const bad of ['Patient/John Smith', 'Patient/pt-1?name=x', 'Basic/x']) {
      expect(() => auditEventToRecord(auditToAuditEvent({ ...audits[0]!, entities: [bad] }))).toThrow()
    }
  })
})
