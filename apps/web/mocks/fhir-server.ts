import type { Bundle, BundleEntry, FhirResource, OperationOutcome } from 'fhir/r4'
import { HttpResponse, http } from 'msw'
import { randomUUID } from 'node:crypto'

export const MOCK_FHIR_BASE = 'http://fhir.mock/fhir'

type Stored = FhirResource & { id: string }
class Precondition extends Error {}

/**
 * In-memory FHIR R4 store: versioned PUT with If-Match, read, vread, a few search parameters and
 * atomic transactions. Only what the BFF uses; any other search parameter is a 400, so drift from
 * HAPI shows up in the contract tests instead of passing silently.
 */
export function createFhirStore() {
  const db = new Map<string, Stored[]>()
  const versionsOf = (type: string, id: string) => db.get(`${type}/${id}`) ?? []

  function check(r: FhirResource & { id?: string }, ifMatch?: string) {
    if (ifMatch !== undefined && ifMatch !== `W/"${versionsOf(r.resourceType, r.id ?? '').length}"`) throw new Precondition()
  }
  function put(r: FhirResource & { id?: string }) {
    const id = r.id ?? randomUUID()
    const vs = versionsOf(r.resourceType, id)
    const version = vs.length + 1
    const stored = { ...structuredClone(r), id, meta: { ...r.meta, versionId: String(version), lastUpdated: new Date().toISOString() } } as Stored
    db.set(`${r.resourceType}/${id}`, [...vs, stored])
    return { stored, version }
  }
  const SEARCH: Record<string, (r: Stored & Record<string, unknown>, v: string) => boolean> = {
    subject: (r, v) => (r.subject as { reference?: string } | undefined)?.reference === v,
    patient: (r, v) => (r.patient as { reference?: string } | undefined)?.reference === v,
    status: (r, v) => r.status === v,
    intent: (r, v) => r.intent === v,
    outcome: (r, v) => r.outcome === v,
    'part-of': (r, v) => ((r.partOf as { reference?: string }[] | undefined) ?? []).some((x) => x.reference === v),
    target: (r, v) => ((r.target as { reference?: string }[] | undefined) ?? []).some((x) => x.reference === v || x.reference?.startsWith(`${v}/_history/`) === true),
    entity: (r, v) => ((r.entity as { what?: { reference?: string } }[] | undefined) ?? []).some((e) => e.what?.reference === v),
    agent: (r, v) => ((r.agent as { who?: { reference?: string } }[] | undefined) ?? []).some((a) => a.who?.reference === v),
  }

  return {
    put,
    read: (type: string, id: string) => versionsOf(type, id).at(-1),
    history: (type: string, id: string) => [...versionsOf(type, id)].reverse(),
    vread: (type: string, id: string, v: number) => versionsOf(type, id)[v - 1],
    search(type: string, params: URLSearchParams): Stored[] {
      const filters = [...params].filter(([k]) => !k.startsWith('_'))
      for (const [k] of filters) if (!SEARCH[k]) throw new Error(`unsupported search parameter ${k}`)
      return [...db.entries()]
        .filter(([k]) => k.startsWith(`${type}/`))
        .map(([, vs]) => vs.at(-1)!)
        .filter((r) => filters.every(([k, v]) => SEARCH[k]!(r as Stored & Record<string, unknown>, v)))
    },
    /** All entries or none: every If-Match is checked before anything is written. */
    transaction(entries: BundleEntry[]): Bundle {
      for (const e of entries) check(e.resource as FhirResource, e.request?.ifMatch)
      return {
        resourceType: 'Bundle',
        type: 'transaction-response',
        entry: entries.map((e) => {
          const { stored, version } = put(e.resource as FhirResource)
          return { response: { status: version === 1 ? '201 Created' : '200 OK', location: `${stored.resourceType}/${stored.id}/_history/${version}`, etag: `W/"${version}"` } }
        }),
      }
    },
    count: () => db.size,
  }
}
export type FhirStore = ReturnType<typeof createFhirStore>

const fhirJson = (body: unknown, status = 200) => HttpResponse.json(body as never, { status, headers: { 'content-type': 'application/fhir+json' } })
const outcome = (status: number, text: string) =>
  fhirJson({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'processing', diagnostics: text }] } satisfies OperationOutcome, status)

export function fhirHandlers(base: string, store: FhirStore) {
  return [
    http.post(base, async ({ request }) => {
      const bundle = (await request.json()) as Bundle
      if (bundle.type !== 'transaction') return outcome(400, 'only transactions are supported')
      try {
        return fhirJson(store.transaction(bundle.entry ?? []))
      } catch (e) {
        return e instanceof Precondition ? outcome(412, 'version conflict') : outcome(400, String(e))
      }
    }),
    http.get(`${base}/:type/:id/_history/:vid`, ({ params }) => {
      const r = store.vread(String(params.type), String(params.id), Number(params.vid))
      return r ? fhirJson(r) : outcome(404, 'not found')
    }),
    http.get(`${base}/:type/:id/_history`, ({ params }) => {
      const versions = store.history(String(params.type), String(params.id))
      return fhirJson({ resourceType: 'Bundle', type: 'history', total: versions.length, entry: versions.map((resource) => ({ resource })) } satisfies Bundle)
    }),
    http.get(`${base}/:type/:id`, ({ params }) => {
      const r = store.read(String(params.type), String(params.id))
      return r ? fhirJson(r) : outcome(404, 'not found')
    }),
    http.get(`${base}/:type`, ({ params, request }) => {
      try {
        const found = store.search(String(params.type), new URL(request.url).searchParams)
        return fhirJson({ resourceType: 'Bundle', type: 'searchset', total: found.length, entry: found.map((resource) => ({ resource })) } satisfies Bundle)
      } catch (e) {
        return outcome(400, String(e))
      }
    }),
    http.post(`${base}/:type`, async ({ request }) => {
      const r = (await request.json()) as FhirResource
      return fhirJson(store.put({ ...r, id: undefined }).stored, 201)
    }),
  ]
}
