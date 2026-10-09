import { ATargetPctMvc, CeilingMa, Contractions, FloorFraction, LIMITS, OffS, OpaqueId, PulseWidthUs, type Plan } from '@symbiomed/domain'
import { Reader, WireError, Writer } from './bytes'
import { FRAME, frame, parseFrame } from './frames'

/** What the brace receives: the approved plan without the clinician data the brace does not need. */
export type WirePlan = {
  patientId: string
  planId: string
  version: number
  issuedAt: string // ISO, whole seconds
  expiresAt: string
  pulseWidthUs: number
  ceilingMa: number
  floorFraction: number
  offS: number
  contractions: number
  aTargetPctMvc: number
  referenceMvcMv: number
}

export const PATIENT_ID_BYTES = 64
export const RESERVED_HMAC_BYTES = 32
const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000)
const iso = (s: number) => new Date(s * 1000).toISOString()
/** A value that needs more precision than the field gives is refused, never rounded: dose parameters stay exact. */
const exact = (v: number, scale: number) => {
  const n = Math.round(v * scale)
  if (Math.abs(n - v * scale) > 1e-6) throw new WireError(`value ${v} needs more precision than the wire format`)
  return n
}

export const toWirePlan = (p: Plan): WirePlan => ({
  patientId: p.patientId, planId: p.planId, version: p.version, issuedAt: iso(sec(p.issuedAt)), expiresAt: iso(sec(p.expiresAt)),
  pulseWidthUs: p.pulseWidthUs, ceilingMa: p.ceilingMa, floorFraction: p.floorFraction, offS: p.offS, contractions: p.contractions,
  aTargetPctMvc: p.aTargetPctMvc, referenceMvcMv: p.referenceMvc.value,
})

export function encodePlan(p: Plan): Uint8Array {
  const w = toWirePlan(p)
  const b = new Writer()
  b.ascii(w.patientId, PATIENT_ID_BYTES)
  b.uuid(w.planId)
  b.u32(w.version)
  b.u32(sec(w.issuedAt))
  b.u32(sec(w.expiresAt))
  b.u16(w.pulseWidthUs)
  b.u8(w.ceilingMa)
  b.u16(exact(w.floorFraction, 1000)) // per mille
  b.u8(w.offS)
  b.u8(w.contractions)
  b.u8(exact(w.aTargetPctMvc, 1))
  b.u16(exact(w.referenceMvcMv, 1000)) // µV
  // TODO(hmac): after the MVP, an HMAC-SHA256 with a per-brace key provisioned at the clinic (decision D-11). Zeros until then.
  b.bytes(new Uint8Array(RESERVED_HMAC_BYTES))
  return frame(FRAME.plan, b.done())
}

export type PlanRejection = 'length' | 'magic' | 'format' | 'crc' | 'type' | 'range' | 'wrong-patient' | 'older-version' | 'expired'
export type PlanCheck = { patientId: string; lastVersion: number | null; now: Date }
export type DecodedPlan = { ok: true; plan: WirePlan } | { ok: false, reason: PlanRejection }

const HOUR = 3600
const ok = (schema: { safeParse(v: unknown): { success: boolean } }, v: unknown) => schema.safeParse(v).success

/**
 * What the brace does with a plan frame, and what the app does before sending one: integrity
 * (length, magic, format, CRC), every field inside the limits, then patient, version and expiry.
 */
export function decodePlan(bytes: Uint8Array, check: PlanCheck): DecodedPlan {
  let p: WirePlan
  try {
    const f = parseFrame(bytes)
    if (f.type !== FRAME.plan) return { ok: false, reason: 'type' }
    const r = new Reader(f.payload)
    p = {
      patientId: r.ascii(PATIENT_ID_BYTES), planId: r.uuid(), version: r.u32(), issuedAt: iso(r.u32()), expiresAt: iso(r.u32()),
      pulseWidthUs: r.u16(), ceilingMa: r.u8(), floorFraction: r.u16() / 1000, offS: r.u8(), contractions: r.u8(), aTargetPctMvc: r.u8(), referenceMvcMv: r.u16() / 1000,
    }
    if (r.bytes(RESERVED_HMAC_BYTES).some((x) => x !== 0)) return { ok: false, reason: 'range' } // until the HMAC exists
    if (r.pos !== f.payload.length) return { ok: false, reason: 'length' }
  } catch (e) {
    if (e instanceof WireError) return { ok: false, reason: (['length', 'magic', 'format', 'crc'].includes(e.message) ? e.message : 'length') as PlanRejection }
    throw e
  }
  const validityH = (sec(p.expiresAt) - sec(p.issuedAt)) / HOUR
  const inRange = ok(OpaqueId, p.patientId) && p.version >= 1 && ok(PulseWidthUs, p.pulseWidthUs) && ok(CeilingMa, p.ceilingMa) && ok(FloorFraction, p.floorFraction) &&
    ok(OffS, p.offS) && ok(Contractions, p.contractions) && ok(ATargetPctMvc, p.aTargetPctMvc) && p.referenceMvcMv > 0 &&
    validityH >= LIMITS.validityH.min && validityH <= LIMITS.validityH.max
  if (!inRange) return { ok: false, reason: 'range' }
  if (p.patientId !== check.patientId) return { ok: false, reason: 'wrong-patient' }
  if (check.lastVersion !== null && p.version <= check.lastVersion) return { ok: false, reason: 'older-version' }
  if (!(check.now.getTime() < Date.parse(p.expiresAt))) return { ok: false, reason: 'expired' }
  return { ok: true, plan: p }
}
