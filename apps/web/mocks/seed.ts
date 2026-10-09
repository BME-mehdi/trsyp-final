import * as fx from '@symbiomed/fixtures'
import { BASE, braceToDevice, decisionToProvenance, planToCarePlan, sessionToFhir, suggestionToCarePlan } from '@symbiomed/fhir'
import type { BundleEntry, FhirResource } from 'fhir/r4'
import type { FhirStore } from './fhir-server'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const DAY_MS = 86_400_000

/**
 * The fixtures live on a fixed synthetic calendar. For demos the seed moves every timestamp by
 * whole days so that FIXTURE_NOW falls on today: plans are current, SYN-04's has expired.
 */
export const dayShift = (now = Date.now()) => Math.floor((now - Date.parse(fx.FIXTURE_NOW)) / DAY_MS) * DAY_MS
const shifted = <T>(x: T, delta: number): T =>
  JSON.parse(JSON.stringify(x), (_k, v: unknown) => (typeof v === 'string' && ISO.test(v) ? new Date(Date.parse(v) + delta).toISOString() : v)) as T

const put = (resource: FhirResource & { id?: string }): BundleEntry => ({ resource, request: { method: 'PUT', url: `${resource.resourceType}/${resource.id}` } })
const chunks = <T>(xs: T[], n = 400) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/**
 * The fixtures as FHIR transactions, in an order that satisfies referential integrity on HAPI.
 * Plan versions go one per transaction, so the server numbers them 1..n like the fixtures.
 */
export function seedTransactions(delta = dayShift()): BundleEntry[][] {
  return shifted(unshiftedTransactions(), delta)
}

function unshiftedTransactions(): BundleEntry[][] {
  const approved = new Set(fx.decisions.map((d) => d.suggestionId))
  const latestPending = new Map<string, string>() // patient -> newest unapproved suggestion
  for (const s of fx.suggestions) if (!approved.has(s.suggestionId)) latestPending.set(s.patientId, s.suggestionId)
  const statusOf = (id: string) => (approved.has(id) ? 'completed' : [...latestPending.values()].includes(id) ? 'draft' : 'revoked')

  const base = [
    ...fx.PRACTITIONERS.map((id) => put({ resourceType: 'Practitioner', id, active: true })),
    ...fx.patients.map((p) => put({ resourceType: 'Patient', id: p.patientId, active: true, identifier: [{ system: `${BASE}/sid/study`, value: p.label }] })),
    ...fx.braces.map((b) => put(braceToDevice(b))),
  ]
  const sessions = fx.sessions.flatMap((s) => {
    const r = sessionToFhir(s, { deviceId: fx.braces.find((b) => b.patientId === s.patientId)?.braceId })
    return [put(r.procedure), ...r.observations.map(put), ...(r.adverseEvent ? [put(r.adverseEvent)] : [])]
  })
  return [
    base,
    ...fx.plans.map((p) => [put(planToCarePlan(p))]),
    ...chunks(sessions),
    ...chunks(fx.suggestions.map((s) => put(suggestionToCarePlan(s, statusOf(s.suggestionId))))),
    ...chunks(fx.decisions.map((d) => put(decisionToProvenance(d)))),
  ]
}

export function seedStore(store: FhirStore) {
  for (const t of seedTransactions()) store.transaction(t)
}
