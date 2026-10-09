import { STEP_UP_MAX_AGE_S } from '../../../../server/config'
import { json } from '../../../../server/errors'
import { IDLE_TIMEOUT_S, SESSION_COOKIE, cookieValue, readSession } from '../../../../server/session'

/** What the browser may know about its session: no tokens, no patient data. */
export async function GET(req: Request): Promise<Response> {
  const s = readSession(cookieValue(req, SESSION_COOKIE))
  if (!s) return json(401, { error: 'unauthenticated', message: 'Sign-in required' })
  const p = s.principal
  return json(200, {
    role: p.role,
    practitionerId: p.practitionerId,
    mfa: p.amr.includes('otp'),
    authAgeS: p.authTime === null ? null : Math.round(Date.now() / 1000 - p.authTime),
    stepUpMaxAgeS: STEP_UP_MAX_AGE_S,
    idleTimeoutS: IDLE_TIMEOUT_S,
    csrf: s.csrf,
  })
}
