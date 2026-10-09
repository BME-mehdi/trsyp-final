import { z } from 'zod'
import { LIMITS } from './limits'

/** Opaque identifier (FHIR id rules): never a name or any other personal data. */
export const OpaqueId = z.string().regex(/^[A-Za-z0-9\-.]{1,64}$/)
/** ISO-8601 instant in UTC ("Z"). */
export const Instant = z.iso.datetime()

const stepped = (r: { min: number; max: number; step: number }) => z.number().min(r.min).max(r.max).multipleOf(r.step)

export const PulseWidthUs = stepped(LIMITS.pulseWidthUs)
export const CeilingMa = stepped(LIMITS.ceilingMa)
export const FloorFraction = z.number().min(LIMITS.floorFraction.min).max(LIMITS.floorFraction.max)
export const OffS = z.literal(LIMITS.offS.allowed)
export const Contractions = z.literal(LIMITS.contractions.allowed)
export const ATargetPctMvc = z.number().min(LIMITS.aTargetPctMvc.min).max(LIMITS.aTargetPctMvc.max)

const HOUR_MS = 3_600_000

export const ReferenceMvcSchema = z.strictObject({
  value: z.number().positive(),
  unit: z.literal(LIMITS.referenceMvcUnit),
  recordedAt: Instant,
  recordedBy: OpaqueId,
})
export type ReferenceMvc = z.infer<typeof ReferenceMvcSchema>

/** An approved plan (CONTRACT.md §2). Strict: the plan goes to the brace, so unknown fields are refused. */
export const PlanSchema = z
  .strictObject({
    planId: z.uuid(),
    patientId: OpaqueId,
    version: z.int().min(1),
    issuedAt: Instant,
    expiresAt: Instant,
    pulseWidthUs: PulseWidthUs,
    ceilingMa: CeilingMa,
    floorFraction: FloorFraction,
    offS: OffS,
    contractions: Contractions,
    aTargetPctMvc: ATargetPctMvc,
    referenceMvc: ReferenceMvcSchema,
    approvedBy: OpaqueId,
    approvedAt: Instant,
  })
  .refine(
    (p) => {
      const h = (Date.parse(p.expiresAt) - Date.parse(p.issuedAt)) / HOUR_MS
      return h >= LIMITS.validityH.min && h <= LIMITS.validityH.max
    },
    { path: ['expiresAt'], message: `validity must be ${LIMITS.validityH.min}–${LIMITS.validityH.max} h after issuedAt` },
  )
export type Plan = z.infer<typeof PlanSchema>

export const validatePlan = (input: unknown) => PlanSchema.safeParse(input)

/** Expired from `expiresAt` onward. Fails closed: an unreadable date counts as expired. */
export const isPlanExpired = (plan: Pick<Plan, 'expiresAt'>, now: Date): boolean =>
  !(now.getTime() < Date.parse(plan.expiresAt))

/** The plan version strictly increases per patient. `prev` is null for the first plan. */
export const nextVersionOk = (prev: number | null, next: number): boolean =>
  Number.isSafeInteger(next) && next >= 1 && (prev === null || next > prev)

/**
 * The reference MVC may only go up (decision D-03): a plan either carries the same recording
 * or a newer, strictly higher one recorded by the clinician.
 */
export function referenceMvcUpdateOk(prev: ReferenceMvc | null, next: ReferenceMvc): boolean {
  if (prev === null) return true
  const same = next.value === prev.value && next.recordedAt === prev.recordedAt && next.recordedBy === prev.recordedBy
  return same || (next.value > prev.value && Date.parse(next.recordedAt) > Date.parse(prev.recordedAt))
}
