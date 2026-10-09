import { OpaqueId } from '@symbiomed/domain'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { z } from 'zod'
import { STEP_UP_MAX_AGE_S, config } from './config'
import { HttpError } from './errors'
import { demoNoOtp } from './mock-mode'
import { SESSION_COOKIE, cookieValue, readSession } from './session'

export type Role = 'patient' | 'clinician' | 'admin'
export type Principal = {
  sub: string
  role: Role
  patientId: string | null
  practitionerId: string | null
  authTime: number | null
  amr: string[]
}

export const DEV_ISSUER = 'symbiomed-dev'

// Keycloak access-token claims the BFF relies on. patient_id / practitioner_id come from user-attribute mappers.
const Claims = z.object({
  sub: z.string().min(1),
  realm_access: z.object({ roles: z.array(z.string()) }).default({ roles: [] }),
  patient_id: OpaqueId.optional(),
  practitioner_id: OpaqueId.optional(),
  auth_time: z.number().optional(),
  amr: z.array(z.string()).default([]),
})

let jwks: { issuer: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null
export function issuerKeys() {
  const issuer = config().OIDC_ISSUER as string
  if (jwks?.issuer !== issuer) jwks = { issuer, set: createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`)) }
  return jwks.set
}

async function verify(token: string): Promise<JWTPayload> {
  const c = config()
  if (c.AUTH_MODE === 'dev') {
    return (await jwtVerify(token, new TextEncoder().encode(c.DEV_AUTH_SECRET), { issuer: DEV_ISSUER, algorithms: ['HS256'] })).payload
  }
  return (await jwtVerify(token, issuerKeys(), { issuer: c.OIDC_ISSUER, audience: c.OIDC_AUDIENCE, algorithms: ['RS256', 'ES256'] })).payload
}

const SAFE_METHODS = ['GET', 'HEAD']

/**
 * Bearer token (mobile app, scripts) or web session cookie -> principal. A cookie-authenticated
 * write also needs the session's CSRF token in x-csrf-token and a same-origin Origin header.
 */
export async function authenticate(req: Request): Promise<Principal> {
  const header = req.headers.get('authorization')
  if (!header) {
    const session = readSession(cookieValue(req, SESSION_COOKIE))
    if (!session) throw new HttpError(401, 'unauthenticated', 'Sign-in required', { headers: { 'www-authenticate': 'Bearer' } })
    if (!SAFE_METHODS.includes(req.method)) {
      const origin = req.headers.get('origin')
      if (req.headers.get('x-csrf-token') !== session.csrf || (origin !== null && origin !== new URL(config().APP_URL).origin)) {
        throw new HttpError(403, 'forbidden', 'Missing or invalid CSRF token')
      }
    }
    return session.principal
  }
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'unauthenticated', 'Sign-in required', { headers: { 'www-authenticate': 'Bearer' } })
  return principalFromToken(token)
}

/** Verifies an access token and maps its claims. Also used by the OIDC callback. */
export async function principalFromToken(token: string): Promise<Principal> {
  let payload: JWTPayload
  try {
    payload = await verify(token)
  } catch {
    throw new HttpError(401, 'unauthenticated', 'Invalid or expired token', { headers: { 'www-authenticate': 'Bearer error="invalid_token"' } })
  }
  const claims = Claims.safeParse(payload)
  if (!claims.success) throw new HttpError(401, 'unauthenticated', 'Token claims are incomplete')
  const roles = (['clinician', 'patient', 'admin'] as const).filter((r) => claims.data.realm_access.roles.includes(r))
  const role = roles.length === 1 ? roles[0] : undefined
  if (!role) throw new HttpError(403, 'forbidden', 'The account needs exactly one of the roles clinician, patient or admin')
  const p: Principal = {
    sub: claims.data.sub,
    role,
    patientId: claims.data.patient_id ?? null,
    practitionerId: claims.data.practitioner_id ?? null,
    authTime: claims.data.auth_time ?? null,
    amr: claims.data.amr,
  }
  if (role === 'patient' && !p.patientId) throw new HttpError(403, 'forbidden', 'Patient account has no patient link')
  if (role === 'clinician' && !p.practitionerId) throw new HttpError(403, 'forbidden', 'Clinician account has no practitioner link')
  return p
}

/**
 * Approving a plan needs MFA and a re-authentication within the last 5 minutes. The 401 follows
 * RFC 9470 so the client knows to send the user back to the IdP with max_age.
 */
export function requireStepUp(p: Principal, now = Date.now()) {
  const fresh = p.authTime !== null && now / 1000 - p.authTime <= STEP_UP_MAX_AGE_S
  const mfa = p.amr.includes('otp') || (demoNoOtp() && p.amr.includes('demo-no-otp'))
  if (!mfa || !fresh) {
    throw new HttpError(401, 'step_up_required', 'Re-authenticate with your second factor to approve a plan', {
      headers: { 'www-authenticate': `Bearer error="insufficient_user_authentication", error_description="MFA within ${STEP_UP_MAX_AGE_S} s required", max_age=${STEP_UP_MAX_AGE_S}` },
    })
  }
}
