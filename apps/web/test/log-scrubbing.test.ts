import { patients } from '@symbiomed/fixtures'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MOCK_FHIR_BASE, createFhirStore, fhirHandlers } from '../mocks/fhir-server'
import { seedStore } from '../mocks/seed'
import { errorResponse } from '../server/errors'
import { approval, arrangeSuggestion, clientFor, clinician, currentPlan, newSession, patient, target } from './harness'

// A fake but realistic piece of personal data. It must never reach a log, an error response or an audit record.
const PHI = 'Zelda Fakepatient, born 1955-03-14, +216 71 000 000'
const own = patients[0]!.patientId

const outgoing: string[] = []
const store = createFhirStore()
seedStore(store)
const server = setupServer(...fhirHandlers(MOCK_FHIR_BASE, store))
const logged: string[] = []

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  server.events.on('request:start', async ({ request }) => void outgoing.push(`${request.method} ${request.url} ${await request.clone().text()}`))
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map((a) => (a instanceof Error ? `${a.name} ${a.message} ${a.stack}` : JSON.stringify(a))).join(' ')))
  }
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Needs the in-memory FHIR server to watch every outgoing request.
describe.runIf(target === 'msw')('no personal data in logs, error responses or audit records', () => {
  it('error responses never echo the input, whatever fails', async () => {
    const bodies: string[] = []
    const capture = (p: Promise<unknown>) => p.then((r) => bodies.push(JSON.stringify(r)), (e: { message: string; code: string }) => bodies.push(`${e.code} ${e.message}`))
    const asPatient = clientFor(await patient(own))
    const asClinician = clientFor(await clinician())
    const plan = (await currentPlan(own))!
    const s = await arrangeSuggestion(own, plan)

    const bad = approval(plan, s, { ceilingMa: 55 })
    bad.decisions[0] = { parameter: 'ceilingMa', action: 'override', reason: PHI }
    await capture(asClinician.approvePlan(own, bad)) // plan_invalid
    await capture(asPatient.postOutcome(own, { sessionId: crypto.randomUUID(), comfort: 2, pain: 11, note: PHI })) // bad_request
    await capture(asPatient.postSession(own, { ...newSession(plan), firmwareVersion: PHI })) // bad_request
    await capture(asPatient.postOutcome(own, { sessionId: crypto.randomUUID(), comfort: 2, pain: 3, note: PHI })) // not_found

    server.use(http.all(`${MOCK_FHIR_BASE}/*`, () => HttpResponse.json({ resourceType: 'OperationOutcome', issue: [{ diagnostics: PHI }] }, { status: 500 })))
    await capture(asPatient.postOutcome(own, { sessionId: crypto.randomUUID(), comfort: 2, pain: 3, note: PHI })) // upstream_unavailable
    bodies.push(await errorResponse(new Error(PHI)).text()) // an unexpected exception carrying the data

    expect(bodies).toHaveLength(6)
    expect(bodies.filter((b) => b.includes('Zelda') || b.includes('1955'))).toEqual([])
    expect(logged.filter((l) => l.includes('Zelda') || l.includes('1955'))).toEqual([])
  })

  it('a stored note goes to the patient record only, never to the audit trail', async () => {
    server.resetHandlers()
    const plan = (await currentPlan(own))!
    const asPatient = clientFor(await patient(own))
    const session = newSession(plan)
    await asPatient.postSession(own, session)
    await asPatient.postOutcome(own, { sessionId: session.sessionId, comfort: 2, pain: 3, note: PHI })
    const audits = outgoing.flatMap((r) => {
      const body = r.slice(r.indexOf('{'))
      if (!body.startsWith('{')) return []
      const json = JSON.parse(body) as { resourceType: string; entry?: { resource: { resourceType: string } }[] }
      return [json, ...(json.entry ?? []).map((e) => e.resource)].filter((x) => x.resourceType === 'AuditEvent').map((x) => JSON.stringify(x))
    })
    expect(audits.length).toBeGreaterThanOrEqual(2) // the session upload and the rating
    expect(audits.filter((a) => a.includes('Zelda'))).toEqual([])
    expect(store.read('Observation', `${session.sessionId}-comfort`)).toMatchObject({ note: [{ text: PHI }] })
    expect(logged.filter((l) => l.includes('Zelda'))).toEqual([])
  })
})
