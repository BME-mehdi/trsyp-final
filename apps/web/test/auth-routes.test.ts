import { afterEach, describe, expect, it } from 'vitest'
import { POST as devLogin } from '../app/api/auth/dev-login/route'
import { POST as logout } from '../app/api/auth/logout/route'
import { GET as sessionInfo } from '../app/api/auth/session/route'
import { GET as devToken } from '../app/api/dev/token/route'
import { POST as sessionAge } from '../app/api/dev/session-age/route'
import { config } from '../server/config'
import { totp } from '../server/totp'
import './harness' // sets AUTH_MODE=dev and a test secret

const APP = 'http://localhost:3000'
const form = (fields: Record<string, string>) => new Request(`${APP}/api/auth/dev-login`, { method: 'POST', body: new URLSearchParams(fields) })
const cookieOf = (res: Response) => res.headers.get('set-cookie') ?? ''
const sid = (setCookie: string) => setCookie.split(';')[0]!

afterEach(() => void delete process.env.MOCK_MODE)

describe('session cookie flags and CSRF on the auth routes', () => {
  it('sets the session cookie httpOnly, Secure, SameSite=Strict, host-only (__Host-), path /', async () => {
    process.env.MOCK_MODE = '1'
    const res = await devLogin(form({ username: 'clinician.demo', password: 'demo-clinician', otp: totp('symbiomed-demo-totp-secret'), returnTo: '/' }))
    expect(res.status).toBe(303)
    expect(cookieOf(res)).toMatch(/^__Host-symbiomed-session=[A-Za-z0-9_-]{40,}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200$/)
    expect(cookieOf(res)).not.toMatch(/Domain=/)
  })

  it('refuses a wrong password or code without setting a cookie, and never redirects off-site', async () => {
    process.env.MOCK_MODE = '1'
    for (const f of [{ password: 'wrong', otp: totp('symbiomed-demo-totp-secret') }, { password: 'demo-clinician', otp: '000000' }]) {
      const res = await devLogin(form({ username: 'clinician.demo', returnTo: 'https://evil.example/', ...f }))
      expect(res.headers.get('location')).toMatch(/^http:\/\/localhost:3000\/dev-login\?returnTo=%2F&error=1/)
      expect(cookieOf(res)).toBe('')
    }
  })

  it('logout needs the CSRF token, then clears the cookie and ends the server session', async () => {
    process.env.MOCK_MODE = '1'
    const cookie = sid(cookieOf(await devLogin(form({ username: 'clinician.demo', password: 'demo-clinician', otp: totp('symbiomed-demo-totp-secret'), returnTo: '/' }))))
    const info = (await (await sessionInfo(new Request(`${APP}/api/auth/session`, { headers: { cookie } }))).json()) as { csrf: string }
    expect((await logout(new Request(`${APP}/api/auth/logout`, { method: 'POST', headers: { cookie } }))).status).toBe(403)
    const out = await logout(new Request(`${APP}/api/auth/logout`, { method: 'POST', headers: { cookie, 'x-csrf-token': info.csrf } }))
    expect(out.status).toBe(200)
    expect(cookieOf(out)).toMatch(/Max-Age=0/)
    expect((await sessionInfo(new Request(`${APP}/api/auth/session`, { headers: { cookie } }))).status).toBe(401)
  })

  it('a new sign-in replaces the old session (no fixation): the old cookie stops working', async () => {
    process.env.MOCK_MODE = '1'
    const login = (cookie?: string) => devLogin(new Request(`${APP}/api/auth/dev-login`, { method: 'POST', headers: cookie ? { cookie } : {}, body: new URLSearchParams({ username: 'clinician.demo', password: 'demo-clinician', otp: totp('symbiomed-demo-totp-secret'), returnTo: '/' }) }))
    const first = sid(cookieOf(await login()))
    const second = sid(cookieOf(await login(first)))
    expect(second).not.toBe(first)
    expect((await sessionInfo(new Request(`${APP}/api/auth/session`, { headers: { cookie: first } }))).status).toBe(401)
    expect((await sessionInfo(new Request(`${APP}/api/auth/session`, { headers: { cookie: second } }))).status).toBe(200)
  })

  it('refuses development sign-in in a production build, and a missing variable at start', () => {
    const saved = { ...process.env }
    try {
      Object.assign(process.env, { NODE_ENV: 'production', AUTH_MODE: 'dev' })
      expect(() => config()).toThrow(/AUTH_MODE=dev is refused in production/)
      Object.assign(process.env, { NODE_ENV: 'test', AUTH_MODE: 'oidc' })
      delete process.env.OIDC_ISSUER
      expect(() => config()).toThrow(/needs OIDC_ISSUER/)
    } finally {
      process.env = saved
    }
  })

  it('dev-only routes do not exist outside mock mode', async () => {
    expect((await devLogin(form({}))).status).toBe(404)
    expect((await devToken(new Request(`${APP}/api/dev/token?as=clinician`))).status).toBe(404)
    expect((await sessionAge(new Request(`${APP}/api/dev/session-age`, { method: 'POST' }))).status).toBe(404)
  })
})
