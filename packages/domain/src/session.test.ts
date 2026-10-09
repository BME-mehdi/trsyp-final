import { describe, expect, it } from 'vitest'
import { BraceSchema, SessionSummarySchema, type SessionSummary } from './index'

const contraction = { index: 0, aV: 28.4, commandedMa: 18, peakMa: 18.3, modelALabel: 'on-target' as const }
const summary: SessionSummary = {
  sessionId: '5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
  patientId: 'pt-test01',
  planId: '3f1d5c7e-8a2b-4c6d-9e0f-1a2b3c4d5e6f',
  planVersion: 3,
  firmwareVersion: '1.4.0',
  startedAt: '2026-03-01T08:00:00.000Z',
  endedAt: '2026-03-01T08:21:00.000Z',
  mode: 1,
  degraded: false,
  contractionsDone: 1,
  peakDeliveredMa: 18.3,
  meanDeliveredMa: 18.3,
  perContraction: [contraction],
  fatigueMdfDropPct: 9.5,
  flexionMaxDeg: 84.5,
  safeStopCause: null,
  comfort: 3,
  pain: 1,
}
const parse = (over: Record<string, unknown>) => SessionSummarySchema.safeParse({ ...summary, ...over })

describe('SessionSummarySchema', () => {
  it('accepts a summary, with or without the patient-entered ratings', () => {
    expect(parse({}).success).toBe(true)
    expect(parse({ comfort: null, pain: null, fatigueMdfDropPct: null }).success).toBe(true)
  })

  it('drops unknown fields instead of refusing the upload', () => {
    const r = parse({ batteryV: 3.9 })
    expect(r.success && !('batteryV' in r.data)).toBe(true)
  })

  it('refuses a commanded plateau above the 50 mA cap but keeps any measured over-current reading', () => {
    expect(parse({ perContraction: [{ ...contraction, commandedMa: 50 }] }).success).toBe(true)
    expect(parse({ perContraction: [{ ...contraction, commandedMa: 50.1 }] }).success).toBe(false)
    expect(parse({ peakDeliveredMa: 61, perContraction: [{ ...contraction, peakMa: 61 }], safeStopCause: 'over-current' }).success).toBe(true)
    expect(parse({ peakDeliveredMa: -1 }).success).toBe(false)
  })

  it('refuses ratings and enums outside the contract', () => {
    for (const over of [
      { comfort: 4 },
      { comfort: -1 },
      { pain: 11 },
      { pain: 4.5 },
      { mode: 2 },
      { safeStopCause: 'pain' },
      { perContraction: [{ ...contraction, modelALabel: 'tired' }] },
      { perContraction: Array.from({ length: 21 }, (_, index) => ({ ...contraction, index })) },
      { contractionsDone: 21 },
      { fatigueMdfDropPct: 101 },
      { firmwareVersion: 'v1 with spaces' },
      { endedAt: '2026-03-01T07:59:59.000Z' },
      { startedAt: '2026-03-01T08:00:00+01:00' },
    ]) {
      expect(parse(over).success, JSON.stringify(over)).toBe(false)
    }
  })
})

describe('BraceSchema', () => {
  const brace = { braceId: 'br-0a1b2c', serial: 'SMB-0042', firmwareVersion: '1.4.0', patientId: 'pt-test01' }
  it('accepts an assigned or unassigned brace and refuses free text', () => {
    expect(BraceSchema.safeParse(brace).success).toBe(true)
    expect(BraceSchema.safeParse({ ...brace, patientId: null }).success).toBe(true)
    expect(BraceSchema.safeParse({ ...brace, serial: 'brace of Mr X' }).success).toBe(false)
  })
})
