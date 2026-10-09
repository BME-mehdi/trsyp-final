import { PatientIdParam } from '@symbiomed/api-client'
import type { z } from 'zod'
import { auditDenied } from './audit'
import { authenticate, type Principal, type Role } from './auth'
import { HttpError, errorResponse, issuesOf, json } from './errors'
import { rateLimit } from './rate-limit'

export type RouteContext = { req: Request; principal: Principal; patientId: string }
type Params = { params: Promise<{ id: string }> }

async function authenticated(req: Request): Promise<Principal> {
  const principal = await authenticate(req).catch((e: unknown) => {
    // Failed sign-ins count per client address: limits token guessing.
    // ponytail: trusts x-forwarded-for; only correct behind a proxy that sets it.
    rateLimit(`ip:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`)
    throw e
  })
  rateLimit(`sub:${principal.sub}`)
  return principal
}

/** A route that is not about one patient (the worklist). Same checks, without the compartment. */
export function apiRoute(roles: Role[], handler: (ctx: { req: Request; principal: Principal }) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      const principal = await authenticated(req)
      if (!roles.includes(principal.role)) throw new HttpError(403, 'forbidden', 'Not allowed for this account')
      return json(200, await handler({ req, principal }))
    } catch (e) {
      return errorResponse(e)
    }
  }
}

/**
 * Every /api/patients/[id]/* route goes through here: authentication, rate limit, role check,
 * patient compartment (a patient only ever reaches their own id), then the handler. Hiding things
 * in the UI is never the control; this is.
 */
export function patientRoute(roles: Role[], handler: (ctx: RouteContext) => Promise<unknown>) {
  return async (req: Request, { params }: Params): Promise<Response> => {
    try {
      const principal = await authenticated(req)
      const id = PatientIdParam.safeParse((await params).id)
      if (!id.success) throw new HttpError(400, 'bad_request', 'Invalid patient id')
      const patientId = id.data
      const compartmentOk = principal.role !== 'patient' || principal.patientId === patientId
      if (!roles.includes(principal.role) || !compartmentOk) {
        await auditDenied(principal, [`Patient/${patientId}`])
        throw new HttpError(403, 'forbidden', 'Not allowed for this account')
      }
      return json(200, await handler({ req, principal, patientId }))
    } catch (e) {
      return errorResponse(e)
    }
  }
}

/** Parses a JSON body with a contract schema; 400 with paths and messages only. */
export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const raw: unknown = await req.json().catch(() => undefined)
  const r = schema.safeParse(raw)
  if (!r.success) throw new HttpError(400, 'bad_request', 'Request body does not match the contract', { issues: issuesOf(r.error) })
  return r.data
}
