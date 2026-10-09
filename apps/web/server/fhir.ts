import type { Bundle, BundleEntry, FhirResource } from 'fhir/r4'
import { config } from './config'
import { HttpError } from './errors'

const HEADERS = { accept: 'application/fhir+json', 'content-type': 'application/fhir+json' }

async function call<T>(url: string, init?: RequestInit): Promise<T | null> {
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: HEADERS, cache: 'no-store' })
  } catch {
    throw new HttpError(503, 'upstream_unavailable', 'FHIR server unreachable')
  }
  if (res.status === 404 || res.status === 410) return null
  if (res.status === 409 || res.status === 412) throw new HttpError(409, 'conflict', 'The record changed meanwhile; reload and try again')
  if (!res.ok) throw new HttpError(503, 'upstream_unavailable', `FHIR server returned ${res.status}`)
  return (await res.json()) as T
}

const base = () => config().FHIR_BASE_URL.replace(/\/$/, '')

/** Minimal FHIR R4 REST client for the BFF. Only the interactions the routes need. */
export const fhir = {
  read: <T extends FhirResource>(type: T['resourceType'], id: string) => call<T>(`${base()}/${type}/${encodeURIComponent(id)}`),

  vread: <T extends FhirResource>(type: T['resourceType'], id: string, version: number) =>
    call<T>(`${base()}/${type}/${encodeURIComponent(id)}/_history/${version}`),

  /** Every match, following `next` links (HAPI pages at most 200 per page). */
  async search<T extends FhirResource>(type: T['resourceType'], params: Record<string, string>): Promise<T[]> {
    const out: T[] = []
    let url: string | undefined = `${base()}/${type}?${new URLSearchParams({ _count: '200', ...params })}`
    while (url) {
      const page: Bundle | null = await call<Bundle>(url)
      out.push(...((page?.entry ?? []).map((e) => e.resource).filter((r): r is T => r?.resourceType === type)))
      url = page?.link?.find((l) => l.relation === 'next')?.url
    }
    return out
  },

  /** One page only, newest first where the server sorts (used for the audit view). */
  async searchPage<T extends FhirResource>(type: T['resourceType'], params: Record<string, string>): Promise<T[]> {
    const page = await call<Bundle>(`${base()}/${type}?${new URLSearchParams(params)}`)
    return (page?.entry ?? []).map((e) => e.resource).filter((r): r is T => r?.resourceType === type)
  },

  /** Every version of one resource (FHIR history), following `next` links. */
  async history<T extends FhirResource>(type: T['resourceType'], id: string): Promise<T[]> {
    const out: T[] = []
    let url: string | undefined = `${base()}/${type}/${encodeURIComponent(id)}/_history?_count=200`
    while (url) {
      const page: Bundle | null = await call<Bundle>(url)
      out.push(...((page?.entry ?? []).map((e) => e.resource).filter((r): r is T => r?.resourceType === type)))
      url = page?.link?.find((l) => l.relation === 'next')?.url
    }
    return out
  },

  create: <T extends FhirResource>(resource: T) => call<T>(`${base()}/${resource.resourceType}`, { method: 'POST', body: JSON.stringify(resource) }),

  /** All-or-nothing write. Entries use PUT with client ids (idempotent) and If-Match where a version matters. */
  async transaction(entries: BundleEntry[]): Promise<Bundle> {
    const bundle: Bundle = { resourceType: 'Bundle', type: 'transaction', entry: entries }
    const r = await call<Bundle>(base(), { method: 'POST', body: JSON.stringify(bundle) })
    if (!r) throw new HttpError(503, 'upstream_unavailable', 'FHIR transaction failed')
    return r
  },
}

export const put = (resource: FhirResource & { id?: string }, ifMatch?: number): BundleEntry => ({
  resource,
  request: { method: 'PUT', url: `${resource.resourceType}/${resource.id}`, ...(ifMatch === undefined ? {} : { ifMatch: `W/"${ifMatch}"` }) },
})

/** Version number assigned by the server, from a transaction-response entry. */
export const versionOf = (e: BundleEntry | undefined) => Number(e?.response?.etag?.match(/\d+/)?.[0] ?? e?.response?.location?.split('/_history/')[1])
