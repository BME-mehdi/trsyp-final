import { config } from '../../../../server/config'
import { authenticate } from '../../../../server/auth'
import { errorResponse, json } from '../../../../server/errors'
import { SESSION_COOKIE, clearSessionCookie, cookieValue, destroySession, readSession } from '../../../../server/session'

/** POST with the CSRF header. Returns where to go next: the Keycloak logout (OIDC) or the sign-in page. */
export async function POST(req: Request): Promise<Response> {
  try {
    await authenticate(req) // checks the CSRF token
    const id = cookieValue(req, SESSION_COOKIE)
    const idToken = readSession(id, Date.now(), false)?.idToken
    destroySession(id)
    const reason = new URL(req.url).searchParams.get('reason') === 'idle' ? 'idle' : 'signed-out'
    const c = config()
    const signin = `${c.APP_URL}/signin?reason=${reason}`
    const redirect = c.AUTH_MODE === 'oidc' && idToken
      ? `${c.OIDC_ISSUER}/protocol/openid-connect/logout?${new URLSearchParams({ id_token_hint: idToken, post_logout_redirect_uri: signin })}`
      : signin
    return json(200, { redirect }, { 'set-cookie': clearSessionCookie })
  } catch (e) {
    return errorResponse(e)
  }
}
