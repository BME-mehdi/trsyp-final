import { createHash, createHmac, randomBytes } from 'node:crypto'

// Scripted logins against the local docker-compose realm, for tests only.
export const KEYCLOAK = process.env.KEYCLOAK_URL ?? 'http://localhost:8180'
export const ISSUER = `${KEYCLOAK}/realms/symbiomed`
const DEMO_TOTP_SECRET = 'symbiomed-demo-totp-secret' // dev realm only (docker/keycloak/symbiomed-realm.json)

export function totp(secret = DEMO_TOTP_SECRET, at = Date.now()) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)))
  const h = createHmac('sha1', Buffer.from(secret, 'utf8')).update(counter).digest()
  return String((h.readUInt32BE(h[19]! & 15) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/** Patient: password grant on the dev-only client. */
export async function passwordToken(username: string, password: string) {
  const res = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'symbiomed-dev', username, password }),
  })
  return ((await res.json()) as { access_token: string }).access_token
}

/** Clinician: the real browser flow (code + PKCE, max_age=300). Keycloak refuses a TOTP code twice, so retry once in the next window. */
export async function browserLogin(username: string, password: string): Promise<string> {
  try {
    return await browserLoginOnce(username, password)
  } catch {
    await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 500))
    return browserLoginOnce(username, password)
  }
}

/**
 * Drives the Keycloak forms (password, then OTP) from an authorization URL and returns the redirect
 * back to the client (with ?code=…&state=…).
 */
export async function keycloakForms(authorizeUrl: string, username: string, password: string): Promise<string> {
  const jar = new Map<string, string>()
  const cookies = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const send = async (url: string, init: RequestInit = {}) => {
    const res = await fetch(url, { ...init, redirect: 'manual', headers: { cookie: cookies(), ...(init.headers ?? {}) } })
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';')
      const i = kv!.indexOf('=')
      jar.set(kv!.slice(0, i), kv!.slice(i + 1))
    }
    return res
  }
  const formAction = (html: string) => html.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&') ?? ''
  const login = await send(authorizeUrl)
  const otpPage = await send(formAction(await login.text()), { method: 'POST', body: new URLSearchParams({ username, password }) })
  const done = await send(formAction(await otpPage.text()), { method: 'POST', body: new URLSearchParams({ otp: totp() }) })
  const location = done.headers.get('location')
  if (!location?.includes('code=')) throw new Error(`Keycloak did not return a code (HTTP ${done.status})`)
  return location
}

async function browserLoginOnce(username: string, password: string): Promise<string> {
  const jar = new Map<string, string>()
  const cookies = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const send = async (url: string, init: RequestInit = {}) => {
    const res = await fetch(url, { ...init, redirect: 'manual', headers: { cookie: cookies(), ...(init.headers ?? {}) } })
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';')
      const i = kv!.indexOf('=')
      jar.set(kv!.slice(0, i), kv!.slice(i + 1))
    }
    return res
  }
  const formAction = (html: string) => html.match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&') ?? ''
  const verifier = randomBytes(32).toString('base64url')
  const redirectUri = 'http://localhost:3000/auth/callback'
  const auth = new URL(`${ISSUER}/protocol/openid-connect/auth`)
  auth.search = new URLSearchParams({
    client_id: 'symbiomed-web', response_type: 'code', scope: 'openid', redirect_uri: redirectUri, max_age: '300',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state: 's', nonce: 'n',
  }).toString()
  const login = await send(auth.toString())
  const otpPage = await send(formAction(await login.text()), { method: 'POST', body: new URLSearchParams({ username, password }) })
  const done = await send(formAction(await otpPage.text()), { method: 'POST', body: new URLSearchParams({ otp: totp() }) })
  const code = new URL(done.headers.get('location') ?? 'http://x/').searchParams.get('code')
  if (!code) throw new Error(`browser login did not return a code (HTTP ${done.status})`)
  const token = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'symbiomed-web', code, redirect_uri: redirectUri, code_verifier: verifier }),
  })
  return ((await token.json()) as { access_token: string }).access_token
}
