import {
  AiSuggestionSchema,
  LIMITS,
  OpaqueId,
  ParameterDecisionSchema,
  PlanSchema,
  ReferenceMvcSchema,
  SessionSummarySchema,
  PLAN_PARAMETERS,
} from '@symbiomed/domain'
import { AuditRecordSchema } from '@symbiomed/fhir'
import { Instant } from '@symbiomed/domain'
import { z } from 'zod'

// The BFF contract: paths and the body of every request and response. Patient ids in paths are opaque.
export const paths = {
  patients: () => '/api/patients',
  planHistory: (patientId: string) => `/api/patients/${patientId}/plan/history`,
  audit: (patientId: string) => `/api/patients/${patientId}/audit`,
  plan: (patientId: string) => `/api/patients/${patientId}/plan`,
  approve: (patientId: string) => `/api/patients/${patientId}/plan/approve`,
  suggestion: (patientId: string) => `/api/patients/${patientId}/suggestion`,
  decisions: (patientId: string) => `/api/patients/${patientId}/decisions`,
  sessions: (patientId: string) => `/api/patients/${patientId}/sessions`,
  outcomes: (patientId: string) => `/api/patients/${patientId}/outcomes`,
} as const

export const PatientIdParam = OpaqueId

/**
 * Approval of the next plan version. Numbers are only typed here: the BFF validates the
 * resulting plan with @symbiomed/domain (validatePlan), so limits live in one place.
 */
export const ApproveRequestSchema = z.strictObject({
  suggestionId: z.uuid(),
  version: z.int(), // the new version: must be exactly current + 1
  plan: z.strictObject({
    pulseWidthUs: z.number(),
    ceilingMa: z.number(),
    floorFraction: z.number(),
    offS: z.number(),
    contractions: z.number(),
    aTargetPctMvc: z.number(),
    validityH: z.number().default(LIMITS.validityH.default),
    referenceMvc: ReferenceMvcSchema,
  }),
  decisions: z
    .array(
      z.strictObject({
        parameter: z.enum(PLAN_PARAMETERS),
        action: z.enum(['accept', 'override']),
        reason: z.string().min(1).max(280).nullable(),
      }),
    )
    .length(PLAN_PARAMETERS.length),
})
export type ApproveRequest = z.input<typeof ApproveRequestSchema>

export const OutcomeRequestSchema = z.strictObject({
  sessionId: z.uuid(),
  comfort: z.int().min(LIMITS.comfort.min).max(LIMITS.comfort.max),
  pain: z.int().min(LIMITS.pain.min).max(LIMITS.pain.max),
  /** Optional patient note; the app warns not to write personal details. */
  note: z.string().trim().max(200).nullable().optional(),
})
export type OutcomeRequest = z.infer<typeof OutcomeRequestSchema>

export const PlanResponseSchema = z.object({ plan: PlanSchema.nullable() })
export const SuggestionResponseSchema = z.object({ suggestion: AiSuggestionSchema.nullable() })
export const ApproveResponseSchema = z.object({ plan: PlanSchema, decisions: z.array(ParameterDecisionSchema) })
export const DecisionResponseSchema = z.object({ decision: ParameterDecisionSchema })
export const SessionsResponseSchema = z.object({ sessions: z.array(SessionSummarySchema) })
export const SessionResponseSchema = z.object({ session: SessionSummarySchema })

/** Worklist row: ids, a study label and statuses only. */
export const WorklistRowSchema = z.object({
  patientId: OpaqueId,
  label: z.string().max(32),
  plan: z.object({ version: z.int(), status: z.enum(['active', 'expired']), expiresAt: Instant, ceilingMa: z.number() }).nullable(),
  pendingSuggestion: z.boolean(),
  lastSessionAt: Instant.nullable(),
  safetyEventsSinceApproval: z.int().min(0),
})
export type WorklistRow = z.infer<typeof WorklistRowSchema>
export const PatientsResponseSchema = z.object({ patients: z.array(WorklistRowSchema) })
export const PlanHistoryResponseSchema = z.object({ plans: z.array(PlanSchema) })
export const DecisionsResponseSchema = z.object({ decisions: z.array(ParameterDecisionSchema) })
export const AuditResponseSchema = z.object({ events: z.array(AuditRecordSchema) })

export const ERROR_CODES = [
  'bad_request',
  'unauthenticated',
  'step_up_required',
  'forbidden',
  'not_found',
  'version_not_newer',
  'version_gap',
  'reference_mvc_lowered',
  'plan_invalid',
  'decision_invalid',
  'conflict',
  'rate_limited',
  'upstream_unavailable',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]
export const ApiErrorSchema = z.object({ error: z.enum(ERROR_CODES), message: z.string(), issues: z.array(z.unknown()).optional() })
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>
