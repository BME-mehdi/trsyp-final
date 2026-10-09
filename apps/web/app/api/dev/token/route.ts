import { config } from '../../../../server/config'
import { mintDevToken } from '../../../../server/dev-auth'
import { json } from '../../../../server/errors'
import { DEMO_USERS } from '../../../../mocks/demo-users'

/**
 * DEV ONLY (pnpm dev:mock): a token for a demo user, so the API can be tried without Keycloak.
 * 404 unless MOCK_MODE=1 and AUTH_MODE=dev; config() refuses AUTH_MODE=dev in production.
 */
export async function GET(req: Request): Promise<Response> {
  if (process.env.MOCK_MODE !== '1' || config().AUTH_MODE !== 'dev') return json(404, { error: 'not_found', message: 'Not found' })
  const as = new URL(req.url).searchParams.get('as') ?? ''
  const user = DEMO_USERS[as as keyof typeof DEMO_USERS]
  if (!user) return json(400, { error: 'bad_request', message: `as= one of ${Object.keys(DEMO_USERS).join(', ')}` })
  return json(200, { access_token: await mintDevToken(user), token_type: 'Bearer' })
}
