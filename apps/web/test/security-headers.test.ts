import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from '../proxy'
import { contentSecurityPolicy } from '../server/security-headers'

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

describe('security headers and CSP', () => {
  it('allows scripts only with the nonce: no unsafe-inline, no unsafe-eval in production', () => {
    const csp = contentSecurityPolicy('abc', false)
    expect(directive(csp, 'script-src')).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'")
    expect(directive(csp, 'style-src')).toBe("style-src 'self' 'nonce-abc'")
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'self'", "default-src 'self'", 'upgrade-insecure-requests']) expect(csp).toContain(d)
    const dev = contentSecurityPolicy('abc', true) // development only
    expect(dev).toContain("'unsafe-eval'")
    expect(directive(dev, 'style-src')).toBe("style-src 'self' 'unsafe-inline'")
  })

  it('sets every header, with a new nonce on each request, passed on to Next', () => {
    const run = () => proxy(new NextRequest('http://localhost:3000/'))
    const [a, b] = [run(), run()]
    for (const [k, v] of Object.entries({
      'strict-transport-security': 'max-age=63072000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
      'cross-origin-opener-policy': 'same-origin',
    })) expect(a.headers.get(k)).toBe(v)
    expect(a.headers.get('permissions-policy')).toContain('serial=(self)')
    const nonce = (r: Response) => r.headers.get('content-security-policy')!.match(/'nonce-([^']+)'/)![1]
    expect(nonce(a)).not.toBe(nonce(b))
    expect(nonce(a)!.length).toBeGreaterThanOrEqual(24)
    expect(a.headers.get('x-middleware-request-x-nonce')).toBe(nonce(a))
  })
})
