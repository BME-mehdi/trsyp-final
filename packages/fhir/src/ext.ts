import type { Extension, FhirResource, Reference } from 'fhir/r4'
import { EXT } from './terminology'

/** A top-level SymbioMed extension. Sub-extensions of a complex extension use short names as url. */
export const ext = (name: string, value: Omit<Extension, 'url'>): Extension => ({ url: EXT + name, ...value })
export const getExt = (exts: Extension[] | undefined, name: string) => exts?.find((e) => e.url === EXT + name)
export const getExts = (exts: Extension[] | undefined, name: string) => exts?.filter((e) => e.url === EXT + name) ?? []
export const sub = (e: Extension | undefined, name: string) => e?.extension?.find((s) => s.url === name)

export const ref = (type: string, id: string): Reference => ({ reference: `${type}/${id}` })
export const versionedRef = (type: string, id: string, version: number): Reference => ({
  reference: `${type}/${id}/_history/${version}`,
})

/** The id in a `Type/id` reference, or undefined when the reference has another shape or type. */
export const refId = (r: Reference | undefined, type: string): string | undefined => {
  const [t, id, ...rest] = r?.reference?.split('/') ?? []
  return t === type && rest.length === 0 ? id : undefined
}

/**
 * Id and version of a `Type/id/_history/n` reference. Servers may strip the version (HAPI does by
 * default), so `Type/id` is accepted too and the version is then undefined.
 */
export const versionedRefParts = (r: Reference | undefined, type: string) => {
  const [t, id, history, version, ...rest] = r?.reference?.split('/') ?? []
  if (t !== type || rest.length > 0) return { id: undefined, version: undefined }
  if (history === undefined) return { id, version: undefined }
  return history === '_history' ? { id, version: Number(version) } : { id: undefined, version: undefined }
}

/** Trust-boundary check on untyped input. The domain schemas then validate every mapped value. */
export function asResource<T extends FhirResource['resourceType']>(input: unknown, type: T): Extract<FhirResource, { resourceType: T }> {
  if (typeof input !== 'object' || input === null || (input as { resourceType?: unknown }).resourceType !== type) {
    throw new TypeError(`expected a FHIR ${type}`)
  }
  return input as Extract<FhirResource, { resourceType: T }>
}
