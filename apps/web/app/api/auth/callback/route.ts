import { config } from '../../../../server/config'
import { errorResponse } from '../../../../server/errors'
import { TX_COOKIE, completeLogin } from '../../../../server/oidc'
import { SESSION_COOKIE, cookieValue, createSession, destroySession, sessionCookie } from '../../../../server/session'

export async function GET(req: Request): Promise<Response> {
  try {
    const q = new URL(req.url).searchParams
    const { principal, idToken, returnTo } = await completeLogin(q.get('code'), q.get('state'), cookieValue(req, TX_COOKIE))
    destroySession(cookieValue(req, SESSION_COOKIE)) // a step-up replaces the old session (no fixation)
    const s = createSession(principal, idToken)
    const headers = new Headers({ location: new URL(returnTo, config().APP_URL).toString(), 'cache-control': 'no-store' })
    headers.append('set-cookie', sessionCookie(s.id))
    headers.append('set-cookie', `${TX_COOKIE}=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
    return new Response(null, { status: 303, headers })
  } catch (e) {
    return errorResponse(e)
  }
}
