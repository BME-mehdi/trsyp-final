import type { ErrorCode } from '@symbiomed/api-client'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly extra: { issues?: unknown[]; headers?: Record<string, string> } = {},
  ) {
    super(message)
  }
}

const SECURITY_HEADERS = { 'cache-control': 'no-store', 'content-type': 'application/json', 'x-content-type-options': 'nosniff' }

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, ...headers } })

/** Never leaks internals: unknown errors become a generic 503 without details (no PHI in error bodies). */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message, ...(e.extra.issues ? { issues: e.extra.issues } : {}) }, e.extra.headers)
  console.error('bff: unexpected error', e instanceof Error ? e.name : typeof e)
  return json(503, { error: 'upstream_unavailable', message: 'Service unavailable' })
}

/** Zod issues reduced to path + message (no input values echoed back). */
export const issuesOf = (error: { issues: { path: PropertyKey[]; message: string }[] }) =>
  error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }))
