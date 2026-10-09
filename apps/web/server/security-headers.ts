/**
 * Response headers for every page and API route (CLAUDE.md web hardening). Scripts run only with
 * the per-request nonce ('strict-dynamic' lets Next load its chunks); there is no 'unsafe-inline'
 * for scripts. Style attributes (React style props, chart SVG) need style-src-attr 'unsafe-inline':
 * an attribute cannot run script, and <style> elements still need the nonce.
 */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`, // React needs eval in development only
    // Development injects CSS as <style> elements without a nonce; production loads CSS files.
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`, // dev: hot reload socket
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

export function securityHeaders(nonce: string, dev: boolean): Record<string, string> {
  return {
    'content-security-policy': contentSecurityPolicy(nonce, dev),
    'strict-transport-security': 'max-age=63072000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(self)',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'cache-control': 'no-store', // pages carry patient data or the CSRF token
  }
}
