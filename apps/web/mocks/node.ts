import { getResponse } from 'msw'
import { setupServer } from 'msw/node'
import { randomBytes } from 'node:crypto'
import { MOCK_FHIR_BASE, createFhirStore, fhirHandlers } from './fhir-server'
import { seedStore } from './seed'

export type MockGlobal = { __symbiomedMockFhir?: (url: string, init?: RequestInit) => Promise<Response> }

/** pnpm dev:mock: FHIR is served from memory by MSW, seeded with the fixtures. No Docker. */
export function startMockMode() {
  process.env.FHIR_BASE_URL ??= MOCK_FHIR_BASE
  process.env.AUTH_MODE ??= 'dev'
  process.env.DEV_AUTH_SECRET ??= randomBytes(32).toString('hex') // per process: dev tokens die with the server
  const store = createFhirStore()
  seedStore(store)
  const handlers = fhirHandlers(MOCK_FHIR_BASE, store)
  setupServer(...handlers).listen({ onUnhandledFrame: 'bypass' })
  // Next's dev server re-patches global fetch on hot reload, which drops MSW's interception. The FHIR client
  // therefore calls the in-memory handlers directly in mock mode (server/fhir.ts); globalThis survives reloads.
  ;(globalThis as MockGlobal).__symbiomedMockFhir = async (url, init) => (await getResponse(handlers, new Request(url, init))) ?? new Response(null, { status: 404 })
  console.log(`mock mode: FHIR in memory at ${MOCK_FHIR_BASE}; tokens at /api/dev/token?as=clinician|patient`)
}
