import { MODEL_A_LABELS, SAFE_STOP_CAUSES, SessionSummarySchema, type SessionSummary } from '@symbiomed/domain'
import { Reader, WireError, Writer } from './bytes'
import { FRAME, frame, parseFrame } from './frames'
import { PATIENT_ID_BYTES } from './plan'

const FIRMWARE_BYTES = 16
const NULL_I16 = 0x7fff
const sec = (iso: string) => {
  const ms = Date.parse(iso)
  if (ms % 1000 !== 0) throw new WireError('session times are whole seconds on the wire')
  return ms / 1000
}
const tenths = (v: number) => {
  const n = Math.round(v * 10)
  if (Math.abs(n - v * 10) > 1e-6) throw new WireError(`value ${v} needs more than one decimal`)
  return n
}

/** Brace side, used by the mock brace and the golden fixtures. Comfort and pain are added by the app later. */
export function encodeSession(s: SessionSummary): Uint8Array {
  const w = new Writer()
  w.uuid(s.sessionId)
  w.ascii(s.patientId, PATIENT_ID_BYTES)
  w.uuid(s.planId)
  w.u32(s.planVersion)
  w.ascii(s.firmwareVersion, FIRMWARE_BYTES)
  w.u32(sec(s.startedAt))
  w.u32(sec(s.endedAt))
  w.u8(s.mode)
  w.u8(s.degraded ? 1 : 0)
  w.u8(s.contractionsDone)
  w.u16(tenths(s.peakDeliveredMa))
  w.u16(tenths(s.meanDeliveredMa))
  w.i16(s.fatigueMdfDropPct === null ? NULL_I16 : tenths(s.fatigueMdfDropPct))
  w.i16(tenths(s.flexionMaxDeg))
  w.u8(s.safeStopCause === null ? 0 : SAFE_STOP_CAUSES.indexOf(s.safeStopCause) + 1)
  w.u8(s.perContraction.length)
  for (const c of s.perContraction) {
    w.u8(c.index)
    w.u16(tenths(c.aV))
    w.u16(tenths(c.commandedMa))
    w.u16(tenths(c.peakMa))
    w.u8(MODEL_A_LABELS.indexOf(c.modelALabel))
  }
  return frame(FRAME.session, w.done())
}

/** App side: frame checks, then the domain schema (a commanded plateau above 50 mA is refused here too). */
export function decodeSession(bytes: Uint8Array): SessionSummary {
  const f = parseFrame(bytes)
  if (f.type !== FRAME.session) throw new WireError('type')
  const r = new Reader(f.payload)
  const head = {
    sessionId: r.uuid(), patientId: r.ascii(PATIENT_ID_BYTES), planId: r.uuid(), planVersion: r.u32(), firmwareVersion: r.ascii(FIRMWARE_BYTES),
    startedAt: new Date(r.u32() * 1000).toISOString(), endedAt: new Date(r.u32() * 1000).toISOString(), mode: r.u8(), degraded: r.u8() === 1,
    contractionsDone: r.u8(), peakDeliveredMa: r.u16() / 10, meanDeliveredMa: r.u16() / 10,
  }
  const fatigue = r.i16()
  const flexion = r.i16() / 10
  const cause = r.u8()
  const count = r.u8()
  const perContraction = Array.from({ length: count }, () => ({ index: r.u8(), aV: r.u16() / 10, commandedMa: r.u16() / 10, peakMa: r.u16() / 10, modelALabel: MODEL_A_LABELS[r.u8()] }))
  if (r.pos !== f.payload.length) throw new WireError('length')
  return SessionSummarySchema.parse({
    ...head, fatigueMdfDropPct: fatigue === NULL_I16 ? null : fatigue / 10, flexionMaxDeg: flexion,
    safeStopCause: cause === 0 ? null : SAFE_STOP_CAUSES[cause - 1], perContraction, comfort: null, pain: null,
  })
}
