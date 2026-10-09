import { plans, sessions } from '@symbiomed/fixtures'
import { describe, expect, it } from 'vitest'
import { GOLDEN_PLAN, GOLDEN_SESSION } from './golden'
import { FRAME, FrameReader, Reader, WireError, crc32, decodePlan, decodeSession, encodePlan, encodeSession, frame, toWirePlan } from './index'

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
const unhex = (h: string) => Uint8Array.from(h.match(/../g)!, (x) => parseInt(x, 16))
// Checked in on purpose: a change to the wire format must show up here. CRCs cross-checked with Python zlib.
const GOLDEN_PLAN_HEX = '534d42500101860070742d326338613662396600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f1d5c7e8a2b4c6d9e0f1a2b3c4d5e6f0c000000f897c86a3892ca6afa001e58022d0a1e5e010000000000000000000000000000000000000000000000000000000000000000599bb34b'
const GOLDEN_SESSION_HEX = '534d4250010299005d6e7f801a2b4c3d8e4f5a6b7c8d9e0f70742d326338613662396600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f1d5c7e8a2b4c6d9e0f1a2b3c4d5e6f0c000000312e342e300000000000000000000000009fc86aeca3c86a010002d600c7005f004d030602001c01b400b7000101dd00d200d6000052cc38fe'
const NOW = new Date('2026-10-09T12:00:00Z')
const check = { patientId: GOLDEN_PLAN.patientId, lastVersion: 11, now: NOW }

describe('CRC-32', () => {
  it('matches the standard check values', () => {
    expect(crc32(Uint8Array.from('123456789', (c) => c.charCodeAt(0)))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array(0))).toBe(0)
  })
})

describe('golden frames', () => {
  it('encodes the golden plan and session to the checked-in bytes', () => {
    expect(hex(encodePlan(GOLDEN_PLAN))).toBe(GOLDEN_PLAN_HEX)
    expect(hex(encodeSession(GOLDEN_SESSION))).toBe(GOLDEN_SESSION_HEX)
  })
  it('decodes the checked-in bytes', () => {
    expect(decodePlan(unhex(GOLDEN_PLAN_HEX), check)).toEqual({ ok: true, plan: toWirePlan(GOLDEN_PLAN) })
    expect(decodeSession(unhex(GOLDEN_SESSION_HEX))).toEqual(GOLDEN_SESSION)
  })
})

describe('round trips', () => {
  it(`every fixture plan (${plans.length})`, () => {
    for (const p of plans) {
      const r = decodePlan(encodePlan(p), { patientId: p.patientId, lastVersion: p.version - 1, now: new Date(p.issuedAt) })
      expect(r).toEqual({ ok: true, plan: toWirePlan(p) })
    }
  })
  it(`every fixture session (${sessions.length}); comfort and pain are added later by the app`, () => {
    for (const s of sessions) expect(decodeSession(encodeSession(s))).toEqual({ ...s, comfort: null, pain: null })
  })
})

describe('corruption is always detected', () => {
  const good = encodePlan(GOLDEN_PLAN)
  it(`rejects a plan with any single byte changed (${good.length} positions × 3 changes)`, () => {
    const accepted: string[] = []
    for (let i = 0; i < good.length; i++) {
      for (const mask of [0x01, 0x80, 0xff]) {
        const bad = good.slice()
        bad[i]! ^= mask
        if (decodePlan(bad, check).ok) accepted.push(`${i}^${mask}`)
      }
    }
    expect(accepted).toEqual([])
  })
  it('rejects every truncation and any extra byte', () => {
    for (let n = 0; n < good.length; n++) expect(decodePlan(good.slice(0, n), check).ok).toBe(false)
    expect(decodePlan(Uint8Array.from([...good, 0]), check)).toEqual({ ok: false, reason: 'length' })
  })
  it('names the integrity problem', () => {
    const crc = good.slice()
    crc[40]! ^= 1
    expect(decodePlan(crc, check)).toEqual({ ok: false, reason: 'crc' })
    const magic = good.slice()
    magic[0] = 0
    expect(decodePlan(magic, check)).toEqual({ ok: false, reason: 'magic' })
  })
  it('rejects a corrupted session frame', () => {
    const s = encodeSession(GOLDEN_SESSION)
    for (let i = 0; i < s.length; i++) {
      const bad = s.slice()
      bad[i]! ^= 0x55
      expect(() => decodeSession(bad)).toThrow()
    }
  })
})

describe('plan checks (as the brace and the app run them)', () => {
  const later = (h: number) => new Date(Date.parse(GOLDEN_PLAN.expiresAt) + h * 3_600_000)
  it('rejects an expired plan, another patient, an older or equal version', () => {
    const b = encodePlan(GOLDEN_PLAN)
    expect(decodePlan(b, { ...check, now: later(0) })).toEqual({ ok: false, reason: 'expired' })
    expect(decodePlan(b, { ...check, patientId: 'pt-other' })).toEqual({ ok: false, reason: 'wrong-patient' })
    expect(decodePlan(b, { ...check, lastVersion: 12 })).toEqual({ ok: false, reason: 'older-version' })
    expect(decodePlan(b, { ...check, lastVersion: 20 })).toEqual({ ok: false, reason: 'older-version' })
    expect(decodePlan(b, { ...check, lastVersion: null }).ok).toBe(true)
  })
  it('rejects a well-formed frame (valid CRC) whose values are outside the limits', () => {
    const payload = new Reader(encodePlan(GOLDEN_PLAN)).bytes(8 + 134).slice(8)
    for (const [offset, value] of [[94, 55], [94, 9], [97, 50], [98, 25], [99, 31]] as const) {
      const p = payload.slice()
      p[offset] = value // ceiling 55 / 9 mA, OFF 50 s, 25 contractions, A_target 31 %
      expect(decodePlan(frame(FRAME.plan, p), check)).toEqual({ ok: false, reason: 'range' })
    }
    const hmac = payload.slice()
    hmac[133] = 1
    expect(decodePlan(frame(FRAME.plan, hmac), check)).toEqual({ ok: false, reason: 'range' })
  })
  it('refuses to encode what the wire cannot carry exactly', () => {
    expect(() => encodePlan({ ...GOLDEN_PLAN, floorFraction: 0.6005 })).toThrow(WireError)
    expect(() => encodePlan({ ...GOLDEN_PLAN, patientId: 'x'.repeat(65) })).toThrow(WireError)
    expect(() => encodeSession({ ...GOLDEN_SESSION, peakDeliveredMa: 21.45 })).toThrow(WireError)
  })
})

describe('FrameReader', () => {
  it('reassembles frames split into any chunk size, after noise', () => {
    const stream = Uint8Array.from([9, 9, ...encodePlan(GOLDEN_PLAN), ...encodeSession(GOLDEN_SESSION)])
    for (const size of [1, 3, 20, 182, 1000]) {
      const r = new FrameReader()
      const got: Uint8Array[] = []
      for (let i = 0; i < stream.length; i += size) got.push(...r.push(stream.slice(i, i + size)))
      expect(got.map(hex)).toEqual([hex(encodePlan(GOLDEN_PLAN)), hex(encodeSession(GOLDEN_SESSION))])
    }
  })
})
