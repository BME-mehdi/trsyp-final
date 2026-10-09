import { NextResponse, type NextRequest } from 'next/server'
import { securityHeaders } from './server/security-headers'

/** A fresh nonce and the security headers on every response (Next applies the nonce to its own scripts). */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const headers = securityHeaders(nonce, process.env.NODE_ENV === 'development')
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', headers['content-security-policy']!)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v)
  return response
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico).*)' }],
}
