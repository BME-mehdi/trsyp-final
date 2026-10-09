import type { ParameterDecision, SessionSummary } from '@symbiomed/domain'
import type { z } from 'zod'
import {
  ApiErrorSchema,
  AuditResponseSchema,
  DecisionsResponseSchema,
  PatientsResponseSchema,
  PlanHistoryResponseSchema,
  ApproveResponseSchema,
  DecisionResponseSchema,
  PlanResponseSchema,
  SessionResponseSchema,
  SessionsResponseSchema,
  SuggestionResponseSchema,
  paths,
  type ApproveRequest,
  type ErrorCode,
  type OutcomeRequest,
} from './contract'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'unexpected',
    message: string,
  ) {
    super(message)
  }
}

export type ClientOptions = {
  baseUrl: string
  /** Mobile: the access token from expo-secure-store. Web: omit; the BFF session cookie is sent instead. */
  getToken?: () => Promise<string | null>
  /** Web: the session's CSRF token, sent on every write. */
  csrfToken?: string
  fetch?: typeof fetch
}

/** Typed client for the BFF. Every response is checked against the shared schemas. */
export function createApiClient({ baseUrl, getToken, csrfToken, fetch: f = fetch }: ClientOptions) {
  async function call<S extends z.ZodType>(schema: S, path: string, body?: unknown): Promise<z.infer<S>> {
    const token = await getToken?.()
    const res = await f(baseUrl + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const e = ApiErrorSchema.safeParse(json)
      throw e.success ? new ApiError(res.status, e.data.error, e.data.message) : new ApiError(res.status, 'unexpected', `HTTP ${res.status}`)
    }
    return schema.parse(json)
  }

  return {
    listPatients: () => call(PatientsResponseSchema, paths.patients()),
    getPlanHistory: (patientId: string) => call(PlanHistoryResponseSchema, paths.planHistory(patientId)),
    getDecisions: (patientId: string) => call(DecisionsResponseSchema, paths.decisions(patientId)),
    getAudit: (patientId: string) => call(AuditResponseSchema, paths.audit(patientId)),
    getPlan: (patientId: string) => call(PlanResponseSchema, paths.plan(patientId)),
    approvePlan: (patientId: string, body: ApproveRequest) => call(ApproveResponseSchema, paths.approve(patientId), body),
    getSuggestion: (patientId: string) => call(SuggestionResponseSchema, paths.suggestion(patientId)),
    postDecision: (patientId: string, decision: ParameterDecision) => call(DecisionResponseSchema, paths.decisions(patientId), decision),
    getSessions: (patientId: string) => call(SessionsResponseSchema, paths.sessions(patientId)),
    postSession: (patientId: string, session: SessionSummary) => call(SessionResponseSchema, paths.sessions(patientId), session),
    postOutcome: (patientId: string, outcome: OutcomeRequest) => call(SessionResponseSchema, paths.outcomes(patientId), outcome),
  }
}
export type ApiClient = ReturnType<typeof createApiClient>
