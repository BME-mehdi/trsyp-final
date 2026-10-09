import { SignJWT } from 'jose'
import { config } from './config'
import { DEV_ISSUER } from './auth'

export type DevClaims = {
  sub: string
  roles: string[]
  patient_id?: string
  practitioner_id?: string
  amr?: string[]
  /** seconds since epoch; defaults to now */
  auth_time?: number
}

/** Dev and test tokens only (AUTH_MODE=dev, refused in production by config()). */
export async function mintDevToken(c: DevClaims, ttlS = 900): Promise<string> {
  const cfg = config()
  if (cfg.AUTH_MODE !== 'dev') throw new Error('dev tokens need AUTH_MODE=dev')
  const now = Math.floor(Date.now() / 1000)
  const { roles, ...rest } = c
  return new SignJWT({ ...rest, realm_access: { roles }, auth_time: c.auth_time ?? now })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(DEV_ISSUER)
    .setSubject(c.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlS)
    .sign(new TextEncoder().encode(cfg.DEV_AUTH_SECRET))
}
