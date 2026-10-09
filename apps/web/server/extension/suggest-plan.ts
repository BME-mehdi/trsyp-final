import type { AiSuggestion } from '@symbiomed/domain'
import { carePlanToSuggestion, suggestionToCarePlan } from '@symbiomed/fhir'
import { config } from '../config'
import { HttpError } from '../errors'
import { fhir, put } from '../fhir'
import { pendingSuggestion } from '../records'

/*
 * ============================ EXTENSION POINT: Model B ============================
 * Plug the existing Node.js backend in here. Set SYMBIOMED_BACKEND_URL and the BFF calls
 *
 *   POST {SYMBIOMED_BACKEND_URL}/fhir/Patient/{id}/$suggest-plan
 *
 * expecting a CarePlan with intent "proposal", the three parameters as `ai-parameter`
 * extensions (see packages/fhir/src/careplan.ts) and the clamp rules already applied.
 * The response is parsed with the domain schemas: a value outside the limits, a missing reason
 * or a non-"simulated" data basis is refused here, whatever the backend sends.
 * TODO(backend): confirm the path, authentication between BFF and backend, and timeouts.
 * Without SYMBIOMED_BACKEND_URL (mock mode and tests), the pending suggestion already stored
 * in FHIR is returned; the seed script loads it from @symbiomed/fixtures.
 * ==================================================================================
 */
export async function suggestPlan(patientId: string): Promise<AiSuggestion | null> {
  const backend = config().SYMBIOMED_BACKEND_URL
  if (!backend) return (await pendingSuggestion(patientId))?.suggestion ?? null

  let res: Response
  try {
    res = await fetch(`${backend.replace(/\/$/, '')}/fhir/Patient/${encodeURIComponent(patientId)}/$suggest-plan`, {
      method: 'POST',
      headers: { accept: 'application/fhir+json', 'content-type': 'application/fhir+json' },
      body: JSON.stringify({ resourceType: 'Parameters', parameter: [] }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new HttpError(503, 'upstream_unavailable', 'Suggestion service unreachable')
  }
  if (!res.ok) throw new HttpError(503, 'upstream_unavailable', `Suggestion service returned ${res.status}`)
  let suggestion: AiSuggestion
  try {
    suggestion = carePlanToSuggestion(await res.json())
  } catch {
    throw new HttpError(503, 'upstream_unavailable', 'Suggestion service returned an invalid suggestion')
  }
  if (suggestion.patientId !== patientId) throw new HttpError(503, 'upstream_unavailable', 'Suggestion is for another patient')

  // Store it as the one pending suggestion; an older pending one is superseded.
  const older = await pendingSuggestion(patientId)
  await fhir.transaction([
    ...(older && older.suggestion.suggestionId !== suggestion.suggestionId ? [put(suggestionToCarePlan(older.suggestion, 'revoked'), older.versionId)] : []),
    put(suggestionToCarePlan(suggestion, 'draft')),
  ])
  return suggestion
}
