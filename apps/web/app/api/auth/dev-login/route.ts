import { config } from '../../../../server/config'
import { json } from '../../../../server/errors'
import { mockMode } from '../../../../server/mock-mode'
import { safeReturnTo } from '../../../../server/oidc'
import { SESSION_COOKIE, cookieValue, createSession, destroySession, sessionCookie } from '../../../../server/session'
import { totpOk } from '../../../../server/totp'
import { DEMO_ACCOUNTS } from '../../../../mocks/demo-users'

/** DEV ONLY: the mock identity provider behind /dev-login (same demo users, passwords and TOTP as Keycloak). */
export async function POST(req: Request): Promise<Response> {
  if (!mockMode()) return json(404, { error: 'not_found', message: 'Not found' })
  const form = await req.formData()
  const returnTo = safeReturnTo(String(form.get('returnTo') ?? '/'))
  const account = DEMO_ACCOUNTS[String(form.get('username') ?? '') as keyof typeof DEMO_ACCOUNTS]
  const passwordOk = account && form.get('password') === account.password
  const otp = String(form.get('otp') ?? '')
  const otpOk = account && (!account.totpSecret || totpOk(account.totpSecret, otp))
  if (!passwordOk || !otpOk) {
    return Response.redirect(new URL(`/dev-login?${new URLSearchParams({ returnTo, error: '1', ...(form.get('stepUp') ? { stepUp: '1' } : {}) })}`, config().APP_URL), 303)
  }
  const c = account.claims
  destroySession(cookieValue(req, SESSION_COOKIE))
  const s = createSession({
    sub: c.sub,
    role: c.roles[0] as 'clinician' | 'patient',
    patientId: 'patient_id' in c ? c.patient_id : null,
    practitionerId: 'practitioner_id' in c ? c.practitioner_id : null,
    authTime: Math.floor(Date.now() / 1000),
    amr: c.amr,
  })
  return new Response(null, { status: 303, headers: { location: new URL(returnTo, config().APP_URL).toString(), 'set-cookie': sessionCookie(s.id), 'cache-control': 'no-store' } })
}
