import { ApiError, type ApiClient } from '@symbiomed/api-client'
import { patients } from '@symbiomed/fixtures'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  approval,
  arrangeSuggestion,
  audits,
  clientFor,
  clinician,
  currentPlan,
  dispatch,
  newSession,
  patient,
  pendingSuggestion,
  startMockFhir,
  target,
  token,
} from './harness'

// The same tests run against MSW (in-memory FHIR) and against the HAPI container.
const [own, other] = [patients[0]!.patientId, patients[1]!.patientId]
const rejects = async (p: Promise<unknown>, status: number, code: string) => {
  const e = await p.then(() => null, (x: unknown) => x)
  expect(e, `expected ${status} ${code}`).toBeInstanceOf(ApiError)
  expect([(e as ApiError).status, (e as ApiError).code]).toEqual([status, code])
}

let stop: () => void
let asPatient: ApiClient
let asClinician: ApiClient
beforeAll(async () => {
  stop = startMockFhir()
  asPatient = clientFor(await patient(own))
  asClinician = clientFor(await clinician())
})
afterAll(() => stop())

describe(`BFF contract against ${target}`, () => {
  describe('authentication, roles and patient compartment', () => {
    it('lets a patient read their own plan', async () => {
      const { plan } = await asPatient.getPlan(own)
      expect(plan?.patientId).toBe(own)
    })

    it("refuses a patient token on another patient's plan, and audits the attempt", async () => {
      const before = await audits(`Patient/${own}`, '4')
      await rejects(asPatient.getPlan(other), 403, 'forbidden')
      await rejects(asPatient.getSessions(other), 403, 'forbidden')
      expect(await audits(`Patient/${own}`, '4')).toBe(before + 2)
    })

    it('keeps clinician-only routes from patients', async () => {
      await rejects(asPatient.getSuggestion(own), 403, 'forbidden')
      const { plan } = await asPatient.getPlan(own)
      await rejects(asPatient.approvePlan(own, approval(plan!, (await pendingSuggestionOrArrange(own))!)), 403, 'forbidden')
    })

    it('refuses missing, forged and role-less tokens', async () => {
      await rejects(clientFor('').getPlan(own), 401, 'unauthenticated')
      await rejects(clientFor('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged').getPlan(own), 401, 'unauthenticated')
      await rejects(clientFor(await token({ roles: ['admin'] })).getPlan(own), 403, 'forbidden')
      await rejects(clientFor(await token({ roles: ['clinician'] })).getPlan(own), 403, 'forbidden') // no practitioner link
    })

    it('writes an AuditEvent for every read', async () => {
      const before = await audits(`Patient/${own}`)
      await asPatient.getPlan(own)
      await asPatient.getSessions(own)
      expect(await audits(`Patient/${own}`)).toBe(before + 2)
    })

    it('marks every response no-store', async () => {
      const res = await dispatch(`http://bff.test/api/patients/${own}/plan`, { headers: { authorization: `Bearer ${await patient(own)}` } })
      expect(res.headers.get('cache-control')).toBe('no-store')
    })
  })

  describe('plan approval', () => {
    it('refuses a clinician without a fresh step-up (RFC 9470 challenge)', async () => {
      const current = (await currentPlan(own))!
      const s = await arrangeSuggestion(own, current)
      const stale = await clinician({ auth_time: Math.floor(Date.now() / 1000) - 600 })
      await rejects(clientFor(stale).approvePlan(own, approval(current, s)), 401, 'step_up_required')
      await rejects(clientFor(await clinician({ amr: ['pwd'] })).approvePlan(own, approval(current, s)), 401, 'step_up_required')
      const res = await dispatch(`http://bff.test/api/patients/${own}/plan/approve`, {
        method: 'POST',
        headers: { authorization: `Bearer ${stale}`, 'content-type': 'application/json' },
        body: JSON.stringify(approval(current, s)),
      })
      expect(res.headers.get('www-authenticate')).toContain('insufficient_user_authentication')
      expect((await currentPlan(own))!.version).toBe(current.version)
    })

    it('refuses a ceiling of 55 mA (domain limits)', async () => {
      const current = (await currentPlan(own))!
      const s = await arrangeSuggestion(own, current)
      await rejects(asClinician.approvePlan(own, approval(current, s, { ceilingMa: 55 })), 422, 'plan_invalid')
      expect((await currentPlan(own))!.version).toBe(current.version)
    })

    it('refuses a lower, an equal and a skipped plan version', async () => {
      const current = (await currentPlan(own))!
      const s = await arrangeSuggestion(own, current)
      await rejects(asClinician.approvePlan(own, approval(current, s, {}, current.version - 1)), 409, 'version_not_newer')
      await rejects(asClinician.approvePlan(own, approval(current, s, {}, current.version)), 409, 'version_not_newer')
      await rejects(asClinician.approvePlan(own, approval(current, s, {}, current.version + 2)), 409, 'version_gap')
    })

    it('refuses a lower reference MVC and inconsistent decisions', async () => {
      const current = (await currentPlan(own))!
      const s = await arrangeSuggestion(own, current)
      const lower = { ...current.referenceMvc, value: current.referenceMvc.value - 0.05, recordedAt: new Date().toISOString() }
      await rejects(asClinician.approvePlan(own, approval(current, s, { referenceMvc: lower })), 422, 'reference_mvc_lowered')
      const accepted = approval(current, s, { ceilingMa: s.ceilingMa.value - 1 })
      accepted.decisions[0] = { parameter: 'ceilingMa', action: 'accept', reason: null } // says accept but changes the value
      await rejects(asClinician.approvePlan(own, accepted), 422, 'decision_invalid')
    })

    it('approves the next version in one transaction: plan, suggestion status, decisions, audit', async () => {
      const current = (await currentPlan(own))!
      const s = await arrangeSuggestion(own, current)
      const auditsBefore = await audits('Practitioner/pr-001')
      const res = await asClinician.approvePlan(own, approval(current, s, { ceilingMa: s.ceilingMa.value - 1 }))
      expect(res.plan.version).toBe(current.version + 1)
      expect(res.decisions.map((d) => [d.parameter, d.action])).toEqual([['ceilingMa', 'override'], ['offS', 'accept'], ['contractions', 'accept']])
      expect((await asPatient.getPlan(own)).plan).toEqual(res.plan)
      expect(await pendingSuggestion(own)).toBeNull()
      expect(await audits('Practitioner/pr-001')).toBeGreaterThan(auditsBefore)
      // The same suggestion cannot be approved twice.
      await rejects(asClinician.approvePlan(own, approval(res.plan, s)), 409, 'conflict')

      // A decision can also be recorded on its own, only when it matches the plan and the suggestion.
      const d = { ...res.decisions[1]!, decisionId: crypto.randomUUID() }
      expect((await asClinician.postDecision(own, d)).decision).toEqual(d)
      await rejects(asClinician.postDecision(own, { ...d, decisionId: crypto.randomUUID(), approvedValue: 90, action: 'override', reason: 'x' }), 422, 'decision_invalid')
      await rejects(asClinician.postDecision(own, { ...d, decidedBy: 'pr-002' }), 403, 'forbidden')
    })

    it('returns the pending suggestion to a clinician, labelled simulated', async () => {
      const current = (await currentPlan(own))!
      const s = await arrangeSuggestion(own, current)
      expect((await asClinician.getSuggestion(own)).suggestion).toEqual(s)
    })
  })

  describe('sessions and patient-reported outcomes', () => {
    it('accepts a session upload (idempotent), then comfort and pain from the patient', async () => {
      const plan = (await currentPlan(own))!
      const s = newSession(plan)
      await asPatient.postSession(own, s)
      await asPatient.postSession(own, s) // retried upload: no duplicate
      const after = (await asPatient.getSessions(own)).sessions.filter((x) => x.sessionId === s.sessionId)
      expect(after).toEqual([s])
      const { session } = await asPatient.postOutcome(own, { sessionId: s.sessionId, comfort: 2, pain: 1 })
      expect([session.comfort, session.pain]).toEqual([2, 1])
      const stored = (await asClinician.getSessions(own)).sessions.find((x) => x.sessionId === s.sessionId)
      expect([stored?.comfort, stored?.pain]).toEqual([2, 1])
    })

    it('refuses a commanded plateau above 50 mA, a foreign session and out-of-range ratings', async () => {
      const plan = (await currentPlan(own))!
      const over = newSession(plan)
      over.perContraction[0]!.commandedMa = 55
      await rejects(asPatient.postSession(own, over), 400, 'bad_request')
      await rejects(asPatient.postSession(other, newSession(plan)), 403, 'forbidden')
      const theirs = (await asClinician.getSessions(other)).sessions.at(-1)!
      await rejects(asPatient.postOutcome(own, { sessionId: theirs.sessionId, comfort: 2, pain: 1 }), 404, 'not_found')
      await rejects(asPatient.postOutcome(own, { sessionId: theirs.sessionId, comfort: 4, pain: 11 }), 400, 'bad_request')
    })
  })

  it('rate-limits per account', async () => {
    process.env.RATE_LIMIT_PER_MINUTE = '3'
    try {
      const c = clientFor(await patient(own))
      for (let i = 0; i < 3; i++) await c.getPlan(own)
      await rejects(c.getPlan(own), 429, 'rate_limited')
    } finally {
      process.env.RATE_LIMIT_PER_MINUTE = '1000'
    }
  })
})

async function pendingSuggestionOrArrange(patientId: string) {
  return (await pendingSuggestion(patientId))?.suggestion ?? arrangeSuggestion(patientId, (await currentPlan(patientId))!)
}
