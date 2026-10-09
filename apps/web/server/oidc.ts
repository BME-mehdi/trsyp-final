import { jwtVerify } from 'jose'
import { createHash, randomBytes } from 'node:crypto'
import { issuerKeys, principalFromToken, type Principal } from './auth'
import { config } from './config'
import { HttpError } from './errors'

export const TX_COOKIE = 'symbiomed-oidc'
type Tx = { verifier: string; nonce: string; returnTo: string; created: number }
const g = globalThis as { __symbiomedOidc?: Map<string, Tx> }
const pending = (g.__symbiomedOidc ??= new Map()) // ponytail: in-memory, like the sessions

/** Only a same-site path: never an open redirect. */
export const safeReturnTo = (v: string | null) => (v && /^\/(?![/\\])/.test(v) ? v : '/')

/** Authorization code + PKCE (S256). Step-up forces a fresh login: prompt=login, max_age=0. */
export function authorizeUrl(returnTo: string, stepUp: boolean) {
  const c = config()
  const state = randomBytes(16).toString('base64url')
  const tx: Tx = { verifier: randomBytes(32).toString('base64url'), nonce: randomBytes(16).toString('base64url'), returnTo, created: Date.now() }
  pending.set(state, tx)
  const url = new URL(`${c.OIDC_ISSUER}/protocol/openid-connect/auth`)
  url.search = new URLSearchParams({
    client_id: c.OIDC_CLIENT_ID,
    response_type: 'code',
    scope: 'openid',
    redirect_uri: `${c.APP_URL}/api/auth/callback`,
    state,
    nonce: tx.nonce,
    code_challenge: createHash('sha256').update(tx.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    ...(stepUp ? { prompt: 'login', max_age: '0' } : {}),
  }).toString()
  return { url: url.toString(), state }
}

export async function completeLogin(code: string | null, state: string | null, stateCookie: string | undefined): Promise<{ principal: Principal; idToken: string; returnTo: string }> {
  const tx = state ? pending.get(state) : undefined
  if (state) pending.delete(state)
  if (!code || !tx || stateCookie !== state || Date.now() - tx.created > 600_000) throw new HttpError(400, 'bad_request', 'Sign-in expired or was not started here')
  const c = config()
  const res = await fetch(`${c.OIDC_ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: c.OIDC_CLIENT_ID, code, redirect_uri: `${c.APP_URL}/api/auth/callback`, code_verifier: tx.verifier }),
  })
  if (!res.ok) throw new HttpError(401, 'unauthenticated', 'Sign-in was refused')
  const tokens = (await res.json()) as { access_token: string; id_token: string }
  const id = await jwtVerify(tokens.id_token, issuerKeys(), { issuer: c.OIDC_ISSUER, audience: c.OIDC_CLIENT_ID })
  if (id.payload.nonce !== tx.nonce) throw new HttpError(401, 'unauthenticated', 'Sign-in response did not match')
  return { principal: await principalFromToken(tokens.access_token), idToken: tokens.id_token, returnTo: tx.returnTo }
}
