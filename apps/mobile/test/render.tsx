import type { ApiClient } from '@symbiomed/api-client'
import type { BraceTransport } from '@symbiomed/brace-protocol'
import type { Plan, SessionSummary } from '@symbiomed/domain'
import { plans, sessions as allSessions } from '@symbiomed/fixtures'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { ApiProvider } from '../src/api'
import { AuthProvider } from '../src/auth'
import { BraceProvider, type BraceStatus } from '../src/brace/status'
import { SettingsProvider, type Settings } from '../src/settings'

export const PATIENT = plans[0]!.patientId
export const secureStore = (globalThis as { __secureStore?: Map<string, string> }).__secureStore!
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
/** An unsigned token with the claims the app reads (the BFF verifies real ones). */
export const fakeToken = (patientId = PATIENT) => `${b64({ alg: 'none' })}.${b64({ patient_id: patientId })}.x`

const HOUR = 3_600_000
export const activePlan = (over: Partial<Plan> = {}): Plan => {
  const base = plans.filter((p) => p.patientId === PATIENT).at(-1)!
  return { ...base, issuedAt: new Date(Date.now() - 4 * HOUR).toISOString(), expiresAt: new Date(Date.now() + 20 * HOUR).toISOString(), ...over }
}
export const patientSessions = (): SessionSummary[] => allSessions.filter((s) => s.patientId === PATIENT)

export function fakeApi(over: Partial<ApiClient> = {}): ApiClient & { calls: string[] } {
  const calls: string[] = []
  const log = <T,>(name: string, v: T) => async () => (calls.push(name), v)
  return {
    calls,
    getPlan: log('getPlan', { plan: activePlan() }),
    getSessions: log('getSessions', { sessions: patientSessions() }),
    postSession: jest.fn(async (_id, s) => (calls.push('postSession'), { session: s })),
    postOutcome: jest.fn(async (_id, o) => (calls.push('postOutcome'), { session: { ...patientSessions().at(-1)!, ...o } })),
    ...over,
  } as unknown as ApiClient & { calls: string[] }
}

export function renderScreen(ui: ReactElement, opts: { api?: ApiClient; settings?: Partial<Settings>; brace?: Partial<BraceStatus>; transport?: BraceTransport; signedIn?: boolean; onSignedOut?: () => void } = {}) {
  secureStore.clear()
  if (opts.signedIn !== false) secureStore.set('symbiomed.access', fakeToken())
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <SettingsProvider initial={{ lang: 'en', textScale: 1, biometric: false, ...opts.settings }}>
        <AuthProvider biometric={opts.settings?.biometric ?? false} onSignedOut={opts.onSignedOut ?? (() => undefined)}>
          <ApiProvider client={opts.api ?? fakeApi()}>
            <BraceProvider value={opts.brace} transport={opts.transport}>{ui}</BraceProvider>
          </ApiProvider>
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>,
  )
}
