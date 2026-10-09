import { patients } from '@symbiomed/fixtures'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { IDLE_TIMEOUT_S, createSession, readSession } from '../server/session'
import { clientFor, clinician, dispatch, patient, startMockFhir, target } from './harness'

// Web sessions (cookie + CSRF) and the screens' read endpoints, against MSW or HAPI.
const own = patients[0]!.patientId
const principal = { sub: 'web-clin', role: 'clinician' as const, patientId: null, practitionerId: 'pr-001', authTime: Math.floor(Date.now() / 1000), amr: ['pwd', 'otp'] }
const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  dispatch(`http://bff.test${path}`, { ...init, headers: { ...(init.cookie ? { cookie: `__Host-symbiomed-session=${init.cookie}` } : {}), ...(init.headers ?? {}) } })

let stop: () => void
beforeAll(() => {
  stop = startMockFhir()
})
afterAll(() => stop())

describe(`web session against ${target}`, () => {
  it('reads with the session cookie, and refuses a write without the CSRF token or from another origin', async () => {
    const s = createSession(principal)
    expect((await call(`/api/patients/${own}/plan`, { cookie: s.id })).status).toBe(200)
    const post = (headers: Record<string, string>) => call(`/api/patients/${own}/outcomes`, { method: 'POST', cookie: s.id, headers: { 'content-type': 'application/json', ...headers }, body: '{}' })
    expect((await post({})).status).toBe(403)
    expect((await post({ 'x-csrf-token': 'wrong' })).status).toBe(403)
    expect((await post({ 'x-csrf-token': s.csrf, origin: 'https://evil.example' })).status).toBe(403)
    expect((await post({ 'x-csrf-token': s.csrf, origin: 'http://localhost:3000' })).status).toBe(403) // valid CSRF; a clinician may not post outcomes
    expect((await call(`/api/patients/${own}/plan`, { cookie: 'not-a-session' })).status).toBe(401)
  })

  it('ends a session after 15 minutes without activity', () => {
    const s = createSession(principal, null, 0)
    expect(readSession(s.id, IDLE_TIMEOUT_S * 1000 - 1)).not.toBeNull()
    expect(readSession(s.id, 2 * IDLE_TIMEOUT_S * 1000)).toBeNull()
    expect(readSession(s.id, 0)).toBeNull() // removed for good
  })
})

describe(`screen endpoints against ${target}`, () => {
  it('lists the worklist with pending approvals first, for clinicians only', async () => {
    const { patients: rows } = await clientFor(await clinician()).listPatients()
    expect(rows.map((r) => r.patientId).sort()).toEqual(patients.map((p) => p.patientId).sort())
    const firstNonPending = rows.findIndex((r) => !r.pendingSuggestion)
    expect(rows.slice(firstNonPending).some((r) => r.pendingSuggestion)).toBe(false)
    await expect(clientFor(await patient(own)).listPatients()).rejects.toMatchObject({ status: 403 })
  })

  it('returns plan history, decision log and audit entries (ids only)', async () => {
    const c = clientFor(await clinician())
    const { plans } = await c.getPlanHistory(own)
    expect(plans.map((p) => p.version)).toEqual(plans.map((_, i) => i + 1))
    const { decisions } = await c.getDecisions(own)
    expect(decisions.length).toBeGreaterThan(0)
    expect(decisions.every((d) => d.planId === plans[0]!.planId)).toBe(true)
    const { events } = await c.getAudit(own)
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.entities.every((x) => /^[A-Za-z]+\/[A-Za-z0-9.-]+(\/_history\/\d+)?$/.test(x)))).toBe(true)
  })
})
