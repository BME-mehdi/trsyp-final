import { json } from '../../../../server/errors'
import { mockMode } from '../../../../server/mock-mode'
import { SESSION_COOKIE, cookieValue, readSession } from '../../../../server/session'

/** DEV/TEST ONLY: moves the sign-in time of the current session back, so step-up can be exercised without waiting. */
export async function POST(req: Request): Promise<Response> {
  if (!mockMode()) return json(404, { error: 'not_found', message: 'Not found' })
  const s = readSession(cookieValue(req, SESSION_COOKIE))
  if (!s || s.principal.authTime === null) return json(401, { error: 'unauthenticated', message: 'Sign-in required' })
  const seconds = Number(new URL(req.url).searchParams.get('seconds') ?? 600)
  const authTime = s.principal.authTime - seconds
  s.principal = { ...s.principal, authTime }
  return json(200, { authAgeS: Math.round(Date.now() / 1000 - authTime) })
}
