import { createHmac, timingSafeEqual } from 'node:crypto'

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), as configured in the Keycloak demo realm. */
export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)))
  const h = createHmac('sha1', Buffer.from(secret, 'utf8')).update(counter).digest()
  return String((h.readUInt32BE(h[19]! & 15) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/** Accepts the current step and one step either side (clock drift). */
export const totpOk = (secret: string, code: string, at = Date.now()) =>
  [-30_000, 0, 30_000].some((d) => {
    const expected = Buffer.from(totp(secret, at + d))
    const given = Buffer.from(code.padEnd(6).slice(0, 6))
    return timingSafeEqual(expected, given)
  })
