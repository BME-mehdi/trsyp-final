import { createApiClient, type ApproveRequest } from '@symbiomed/api-client'
import type { AiSuggestion, Plan, SessionSummary } from '@symbiomed/domain'
import { suggestionToCarePlan } from '@symbiomed/fhir'
import type { AuditEvent } from 'fhir/r4'
import { setupServer } from 'msw/node'
import { randomUUID } from 'node:crypto'
import { MOCK_FHIR_BASE, createFhirStore, fhirHandlers } from '../mocks/fhir-server'
import { seedStore } from '../mocks/seed'
import { mintDevToken, type DevClaims } from '../server/dev-auth'
import { fhir, put } from '../server/fhir'
import { currentPlan, pendingSuggestion, sessionsOf } from '../server/records'
import * as audit from '../app/api/patients/[id]/audit/route'
import * as decisions from '../app/api/patients/[id]/decisions/route'
import * as history from '../app/api/patients/[id]/plan/history/route'
import * as worklist from '../app/api/patients/route'
import * as outcomes from '../app/api/patients/[id]/outcomes/route'
import * as approve from '../app/api/patients/[id]/plan/approve/route'
import * as plan from '../app/api/patients/[id]/plan/route'
import * as sessions from '../app/api/patients/[id]/sessions/route'
import * as suggestion from '../app/api/patients/[id]/suggestion/route'

/** CONTRACT_TARGET=msw (default, in-memory FHIR) or hapi (docker compose, seeded). */
export const target = process.env.CONTRACT_TARGET === 'hapi' ? 'hapi' : 'msw'

process.env.FHIR_BASE_URL = target === 'hapi' ? (process.env.CONTRACT_FHIR_URL ?? 'http://localhost:8090/fhir') : MOCK_FHIR_BASE
process.env.AUTH_MODE = 'dev'
process.env.DEV_AUTH_SECRET = randomUUID() + randomUUID()
process.env.RATE_LIMIT_PER_MINUTE = '1000'

export function startMockFhir() {
  if (target !== 'msw') return () => undefined
  const store = createFhirStore()
  seedStore(store)
  const server = setupServer(...fhirHandlers(MOCK_FHIR_BASE, store))
  server.listen({ onUnhandledFrame: 'error' }) // any call that is not to the mock FHIR server fails the test
  return () => server.close()
}

// In-process dispatch: the api-client calls the Next route handlers directly, no HTTP server needed.
type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
const ROUTES: [RegExp, Partial<Record<string, Handler>>][] = [
  [/^\/api\/patients()$/, worklist],
  [/^\/api\/patients\/([^/]+)\/plan\/history$/, history],
  [/^\/api\/patients\/([^/]+)\/audit$/, audit],
  [/^\/api\/patients\/([^/]+)\/plan$/, plan],
  [/^\/api\/patients\/([^/]+)\/plan\/approve$/, approve],
  [/^\/api\/patients\/([^/]+)\/suggestion$/, suggestion],
  [/^\/api\/patients\/([^/]+)\/decisions$/, decisions],
  [/^\/api\/patients\/([^/]+)\/sessions$/, sessions],
  [/^\/api\/patients\/([^/]+)\/outcomes$/, outcomes],
]
export const dispatch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const req = new Request(input, init)
  for (const [re, mod] of ROUTES) {
    const m = new URL(req.url).pathname.match(re)
    if (!m) continue
    const h = mod[req.method]
    return h ? h(req, { params: Promise.resolve({ id: decodeURIComponent(m[1]!) }) }) : new Response(null, { status: 405 })
  }
  return new Response(null, { status: 404 })
}

export const token = (c: Partial<DevClaims> & { roles: string[] }) => mintDevToken({ sub: `test-${randomUUID()}`, ...c })
export const clinician = (over: Partial<DevClaims> = {}) => token({ roles: ['clinician'], practitioner_id: 'pr-001', amr: ['pwd', 'otp'], ...over })
export const patient = (patientId: string) => token({ roles: ['patient'], patient_id: patientId, amr: ['pwd'] })
export const clientFor = (tok: string) => createApiClient({ baseUrl: 'http://bff.test', getToken: async () => tok, fetch: dispatch })

/** Arrange: a fresh pending suggestion for a patient (Model B stand-in), replacing any pending one. */
export async function arrangeSuggestion(patientId: string, plan: Plan): Promise<AiSuggestion> {
  const [last] = (await sessionsOf(patientId)).slice(-1)
  const reasons = [
    { feature: 'comfort', text: 'comfort rating 3/3', contribution: 0.4 },
    { feature: 'day', text: 'day 43', contribution: 0.2 },
  ] as AiSuggestion['ceilingMa']['reasons']
  const value = <V extends number>(v: V) => ({ value: v, reasons, clamped: false, clampReason: null })
  const s: AiSuggestion = {
    suggestionId: randomUUID(),
    patientId,
    basedOnSessionId: last!.sessionId,
    ceilingMa: value(Math.min(plan.ceilingMa + 2, 50)),
    offS: value(plan.offS),
    contractions: value(plan.contractions),
    dataBasis: 'simulated',
  }
  const older = await pendingSuggestion(patientId)
  await fhir.transaction([
    ...(older ? [put(suggestionToCarePlan(older.suggestion, 'revoked'), older.versionId)] : []),
    put(suggestionToCarePlan(s, 'draft')),
  ])
  return s
}

export const approval = (current: Plan, s: AiSuggestion, plan: Partial<ApproveRequest['plan']> = {}, version = current.version + 1): ApproveRequest => ({
  suggestionId: s.suggestionId,
  version,
  plan: {
    pulseWidthUs: current.pulseWidthUs,
    ceilingMa: s.ceilingMa.value,
    floorFraction: current.floorFraction,
    offS: s.offS.value,
    contractions: s.contractions.value,
    aTargetPctMvc: current.aTargetPctMvc,
    validityH: 36,
    referenceMvc: current.referenceMvc,
    ...plan,
  },
  decisions: [
    plan.ceilingMa === undefined || plan.ceilingMa === s.ceilingMa.value
      ? { parameter: 'ceilingMa', action: 'accept', reason: null }
      : { parameter: 'ceilingMa', action: 'override', reason: 'Clinician choice' },
    { parameter: 'offS', action: 'accept', reason: null },
    { parameter: 'contractions', action: 'accept', reason: null },
  ],
})

/** A new session summary on the patient's current plan, as the brace would report it. */
export function newSession(p: Plan, over: Partial<SessionSummary> = {}): SessionSummary {
  const started = new Date(Date.now() - 30 * 60_000)
  const row = { index: 0, aV: 30.2, commandedMa: Math.round(p.floorFraction * p.ceilingMa * 10) / 10, peakMa: 20.1, modelALabel: 'on-target' as const }
  return {
    sessionId: randomUUID(), patientId: p.patientId, planId: p.planId, planVersion: p.version, firmwareVersion: '1.4.0',
    startedAt: started.toISOString(), endedAt: new Date(started.getTime() + 20 * 60_000).toISOString(),
    mode: 1, degraded: false, contractionsDone: 1, peakDeliveredMa: 20.1, meanDeliveredMa: 20.1, perContraction: [row],
    fatigueMdfDropPct: 8.5, flexionMaxDeg: 101.5, safeStopCause: null, comfort: null, pain: null, ...over,
  }
}

export const audits = (agent: string, outcome = '0') => fhir.search<AuditEvent>('AuditEvent', { agent, outcome }).then((a) => a.length)
export { currentPlan, pendingSuggestion }
