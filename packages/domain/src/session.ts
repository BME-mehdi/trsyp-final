import { z } from 'zod'
import { LIMITS } from './limits'
import { Instant, OpaqueId } from './plan'

export const SAFE_STOP_CAUSES = [
  'stop-button',
  'usb',
  'battery',
  'watchdog',
  'sensor-fault',
  'lead-off',
  'current-error',
  'over-current',
] as const
export type SafeStopCause = (typeof SAFE_STOP_CAUSES)[number]

export const MODEL_A_LABELS = ['under', 'on-target', 'fatigued', 'guarding'] as const
export type ModelALabel = (typeof MODEL_A_LABELS)[number]

const MAX_CONTRACTIONS = Math.max(...LIMITS.contractions.allowed)
// Measured current has no upper bound on purpose: an over-current reading must reach the clinician.
const MeasuredMa = z.number().nonnegative()
// Spec IX.3: uploads with a commanded plateau above the 50 mA cap are rejected.
const CommandedMa = z.number().min(0).max(LIMITS.ceilingMa.max)

export const ContractionSchema = z.object({
  index: z.int().min(0),
  aV: z.number().nonnegative(), // % of reference MVC
  commandedMa: CommandedMa,
  peakMa: MeasuredMa,
  modelALabel: z.enum(MODEL_A_LABELS),
})
export type Contraction = z.infer<typeof ContractionSchema>

/**
 * Session summary (CONTRACT.md §4), brace -> app -> backend. Unknown fields are dropped, not
 * refused, so a newer firmware field never makes an upload (and the session) get lost.
 */
export const SessionSummarySchema = z
  .object({
    sessionId: z.uuid(),
    patientId: OpaqueId,
    planId: z.uuid(),
    planVersion: z.int().min(1),
    firmwareVersion: z.string().regex(/^[\w.+-]{1,32}$/),
    startedAt: Instant,
    endedAt: Instant,
    mode: z.literal([0, 1]),
    degraded: z.boolean(),
    contractionsDone: z.int().min(0).max(MAX_CONTRACTIONS),
    peakDeliveredMa: MeasuredMa,
    meanDeliveredMa: MeasuredMa,
    perContraction: z.array(ContractionSchema).max(MAX_CONTRACTIONS),
    fatigueMdfDropPct: z.number().max(100).nullable(), // null when no valid EMG window
    flexionMaxDeg: z.number(),
    safeStopCause: z.enum(SAFE_STOP_CAUSES).nullable(),
    comfort: z.int().min(LIMITS.comfort.min).max(LIMITS.comfort.max).nullable(), // patient-entered
    pain: z.int().min(LIMITS.pain.min).max(LIMITS.pain.max).nullable(), // patient-entered
  })
  .refine((s) => Date.parse(s.endedAt) >= Date.parse(s.startedAt), {
    path: ['endedAt'],
    message: 'endedAt must not be before startedAt',
  })
export type SessionSummary = z.infer<typeof SessionSummarySchema>

/** The brace as a device record (FHIR Device). */
export const BraceSchema = z.object({
  braceId: OpaqueId,
  serial: z.string().regex(/^[\w.-]{1,64}$/),
  firmwareVersion: z.string().regex(/^[\w.+-]{1,32}$/),
  patientId: OpaqueId.nullable(),
})
export type Brace = z.infer<typeof BraceSchema>
