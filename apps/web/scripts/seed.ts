// Loads the synthetic fixtures into the FHIR server: pnpm --filter @symbiomed/web seed
// FHIR_BASE_URL defaults to the docker-compose HAPI. Skips when the data is already there.
import * as fx from '@symbiomed/fixtures'
import { seedTransactions } from '../mocks/seed'

const base = (process.env.FHIR_BASE_URL ?? 'http://localhost:8090/fhir').replace(/\/$/, '')
const headers = { accept: 'application/fhir+json', 'content-type': 'application/fhir+json' }

const first = await fetch(`${base}/Patient/${fx.patients[0]!.patientId}`, { headers })
if (first.ok) {
  console.log(`seed: ${base} already holds the fixtures, nothing to do`)
  process.exit(0)
}
const steps = seedTransactions()
let resources = 0
for (const [i, entry] of steps.entries()) {
  const res = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ resourceType: 'Bundle', type: 'transaction', entry }) })
  if (!res.ok) {
    console.error(`seed: transaction ${i + 1}/${steps.length} failed with ${res.status}: ${(await res.text()).slice(0, 500)}`)
    process.exit(1)
  }
  resources += entry.length
  if ((i + 1) % 50 === 0) console.log(`seed: ${i + 1}/${steps.length} transactions`)
}
console.log(`seed: loaded ${resources} resources in ${steps.length} transactions into ${base}`)
