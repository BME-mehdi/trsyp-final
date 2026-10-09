import { config } from '../../../../server/config'
import { authorizeUrl, safeReturnTo, TX_COOKIE } from '../../../../server/oidc'

/** Starts sign-in (or step-up with ?stepUp=1). Mock mode goes to the dev sign-in form instead of Keycloak. */
export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams
  const returnTo = safeReturnTo(q.get('returnTo'))
  const stepUp = q.get('stepUp') === '1'
  if (config().AUTH_MODE === 'dev') {
    return Response.redirect(new URL(`/dev-login?${new URLSearchParams({ returnTo, ...(stepUp ? { stepUp: '1' } : {}) })}`, config().APP_URL), 303)
  }
  const { url, state } = authorizeUrl(returnTo, stepUp)
  return new Response(null, {
    status: 303,
    headers: { location: url, 'set-cookie': `${TX_COOKIE}=${state}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`, 'cache-control': 'no-store' },
  })
}
