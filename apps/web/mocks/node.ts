import { setupServer } from 'msw/node'
import { randomBytes } from 'node:crypto'
import { MOCK_FHIR_BASE, createFhirStore, fhirHandlers } from './fhir-server'
import { seedStore } from './seed'

/** pnpm dev:mock: FHIR is served from memory by MSW, seeded with the fixtures. No Docker. */
export function startMockMode() {
  process.env.FHIR_BASE_URL ??= MOCK_FHIR_BASE
  process.env.AUTH_MODE ??= 'dev'
  process.env.DEV_AUTH_SECRET ??= randomBytes(32).toString('hex') // per process: dev tokens die with the server
  const store = createFhirStore()
  seedStore(store)
  setupServer(...fhirHandlers(MOCK_FHIR_BASE, store)).listen({ onUnhandledFrame: 'bypass' })
  console.log(`mock mode: FHIR in memory at ${MOCK_FHIR_BASE}; tokens at /api/dev/token?as=clinician|patient`)
}
