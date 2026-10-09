import { ApiError } from '@symbiomed/api-client'
import { patients } from '@symbiomed/fixtures'
import { beforeAll, describe, expect, it } from 'vitest'
import { approval, arrangeSuggestion, clientFor, currentPlan, target } from './harness'
import { GET as callback } from '../app/api/auth/callback/route'
import { GET as login } from '../app/api/auth/login/route'
import { GET as sessionInfo } from '../app/api/auth/session/route'
import { ISSUER, browserLogin, keycloakForms, passwordToken } from './keycloak/login'

// Real Keycloak tokens (docker compose) through the BFF in OIDC mode. Runs with the HAPI target only.
describe.runIf(target === 'hapi')('BFF with the Keycloak demo realm', () => {
  const [own, other] = [patients[0]!.patientId, patients[1]!.patientId]
  beforeAll(() => {
    process.env.AUTH_MODE = 'oidc'
    process.env.OIDC_ISSUER = ISSUER
    process.env.OIDC_AUDIENCE = 'symbiomed-bff'
  })

  it('patient.demo reads their own plan and nobody else’s', async () => {
    const c = clientFor(await passwordToken('patient.demo', 'demo-patient'))
    expect((await c.getPlan(own)).plan?.patientId).toBe(own)
    const e = await c.getPlan(other).catch((x: unknown) => x)
    expect([(e as ApiError).status, (e as ApiError).code]).toEqual([403, 'forbidden'])
  })

  it('web sign-in through the BFF: code + PKCE, state and nonce checked, httpOnly session cookie, MFA seen', async () => {
    const start = await login(new Request('http://localhost:3000/api/auth/login?returnTo=/patients/x'))
    const tx = start.headers.get('set-cookie')!
    expect(tx).toMatch(/HttpOnly; Secure; SameSite=Lax/)
    const back = new URL(await keycloakForms(start.headers.get('location')!, 'clinician.demo', 'demo-clinician'))
    const done = await callback(new Request(back, { headers: { cookie: tx.split(';')[0]! } }))
    expect([done.status, done.headers.get('location')]).toEqual([303, 'http://localhost:3000/patients/x'])
    const cookie = done.headers.getSetCookie().find((c) => c.startsWith('__Host-symbiomed-session='))!
    expect(cookie).toMatch(/Path=\/; HttpOnly; Secure; SameSite=Strict/)
    const info = (await (await sessionInfo(new Request('http://localhost:3000/api/auth/session', { headers: { cookie: cookie.split(';')[0]! } }))).json()) as { role: string; mfa: boolean; authAgeS: number }
    expect([info.role, info.mfa, info.authAgeS < 60]).toEqual(['clinician', true, true])
    // A replayed callback (same state) is refused.
    expect((await callback(new Request(back, { headers: { cookie: tx.split(';')[0]! } }))).status).toBe(400)
  }, 90_000)

  it('clinician.demo approves after a password + TOTP login within 5 minutes', async () => {
    const c = clientFor(await browserLogin('clinician.demo', 'demo-clinician'))
    const id = patients[4]!.patientId // not the patient the contract tests use
    const current = (await currentPlan(id))!
    const s = await arrangeSuggestion(id, current)
    const { plan } = await c.approvePlan(id, approval(current, s))
    expect(plan.version).toBe(current.version + 1)
    expect(plan.approvedBy).toBe('pr-001')
  }, 90_000)
})
