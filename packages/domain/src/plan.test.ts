import { describe, expect, it } from 'vitest'
import { LIMITS, isPlanExpired, nextVersionOk, referenceMvcUpdateOk, validatePlan, type Plan } from './index'

// Seeded PRNG (mulberry32) so every random sweep is reproducible.
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const H = 3_600_000
const ISSUED = '2026-03-01T07:30:00.000Z'
const iso = (ms: number) => new Date(ms).toISOString()
const base: Plan = {
  planId: '3f1d5c7e-8a2b-4c6d-9e0f-1a2b3c4d5e6f',
  patientId: 'pt-test01',
  version: 3,
  issuedAt: ISSUED,
  expiresAt: iso(Date.parse(ISSUED) + 36 * H),
  pulseWidthUs: 250,
  ceilingMa: 30,
  floorFraction: 0.6,
  offS: 45,
  contractions: 10,
  aTargetPctMvc: 30,
  referenceMvc: { value: 0.35, unit: 'mV', recordedAt: '2026-02-20T10:00:00.000Z', recordedBy: 'pr-001' },
  approvedBy: 'pr-001',
  approvedAt: ISSUED,
}

// Oracle: written straight from LIMITS, independent of the Zod schema it checks.
type Range = { min: number; max: number }
const inRange = (v: unknown, r: Range) => typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max
const onStep = (v: unknown, step: number) => Number.isInteger((v as number) / step)
const oneOf = (v: unknown, allowed: readonly number[]) => allowed.some((a) => a === v)
const ORACLE = {
  pulseWidthUs: (v: unknown) => inRange(v, LIMITS.pulseWidthUs) && onStep(v, LIMITS.pulseWidthUs.step),
  ceilingMa: (v: unknown) => inRange(v, LIMITS.ceilingMa) && onStep(v, LIMITS.ceilingMa.step),
  floorFraction: (v: unknown) => inRange(v, LIMITS.floorFraction),
  offS: (v: unknown) => oneOf(v, LIMITS.offS.allowed),
  contractions: (v: unknown) => oneOf(v, LIMITS.contractions.allowed),
  aTargetPctMvc: (v: unknown) => inRange(v, LIMITS.aTargetPctMvc),
}
type Field = keyof typeof ORACLE
const FIELDS = Object.keys(ORACLE) as Field[]
const validityOk = (expiresAt: string) => inRange((Date.parse(expiresAt) - Date.parse(ISSUED)) / H, LIMITS.validityH)

const RANGES: Record<Field, Range> = {
  pulseWidthUs: LIMITS.pulseWidthUs,
  ceilingMa: LIMITS.ceilingMa,
  floorFraction: LIMITS.floorFraction,
  offS: { min: 30, max: 90 },
  contractions: { min: 10, max: 20 },
  aTargetPctMvc: LIMITS.aTargetPctMvc,
}
const edges = (r: Range) => [r.min, r.max, r.min - 1e-9, r.max + 1e-9, r.min - 0.5, r.max + 0.5, r.min - 1, r.max + 1, (r.min + r.max) / 2, r.min + 0.25]
const JUNK: unknown[] = [NaN, Infinity, -Infinity, 0, -1, 1e9, -1e9, '30', '', null, undefined, true, {}, []]
const allowedOf = (f: Field): readonly number[] =>
  f === 'offS' ? LIMITS.offS.allowed : f === 'contractions' ? LIMITS.contractions.allowed : []

function randomValue(rng: () => number, f: Field): unknown {
  const r = RANGES[f]
  const span = Math.max(r.max - r.min, 1)
  const x = r.min - span + rng() * 3 * span
  const roll = rng()
  if (roll < 0.1) return JUNK[Math.floor(rng() * JUNK.length)]
  if (roll < 0.3 && allowedOf(f).length) return allowedOf(f)[Math.floor(rng() * allowedOf(f).length)]
  return roll < 0.65 ? Math.round(x) : x
}

describe('validatePlan', () => {
  it('accepts the baseline plan', () => {
    expect(validatePlan(base).success).toBe(true)
  })

  it('passes a value only when it lies inside limits.ts (boundaries, junk and 1,000 random values per field)', () => {
    const rng = mulberry32(1)
    const mismatches: unknown[] = []
    for (const f of FIELDS) {
      const random = Array.from({ length: 1000 }, () => randomValue(rng, f))
      for (const v of [...edges(RANGES[f]), ...allowedOf(f), ...JUNK, ...random]) {
        if (validatePlan({ ...base, [f]: v }).success !== ORACLE[f](v)) mismatches.push({ f, v })
      }
    }
    expect(mismatches).toEqual([])
  })

  it('passes a validity window only inside 12–168 h', () => {
    const rng = mulberry32(2)
    const hours = [...edges(LIMITS.validityH), 0, -1, 1000, ...Array.from({ length: 1000 }, () => rng() * 200 - 10)]
    const mismatches = hours
      .map((h) => iso(Date.parse(ISSUED) + h * H))
      .filter((expiresAt) => validatePlan({ ...base, expiresAt }).success !== validityOk(expiresAt))
    expect(mismatches).toEqual([])
    for (const expiresAt of ['2026-03-02', '2026-03-02T19:30:00+01:00', 'tomorrow', '']) {
      expect(validatePlan({ ...base, expiresAt }).success).toBe(false)
    }
  })

  it('agrees with the oracle on 5,000 random multi-field plans', () => {
    const rng = mulberry32(3)
    let accepted = 0
    const mismatches: unknown[] = []
    for (let i = 0; i < 5000; i++) {
      const plan: Record<string, unknown> = { ...base }
      for (const f of FIELDS) if (rng() < 0.3) plan[f] = randomValue(rng, f)
      if (rng() < 0.3) plan.expiresAt = iso(Date.parse(ISSUED) + (rng() * 200 - 10) * H)
      const expected = FIELDS.every((f) => ORACLE[f](plan[f])) && validityOk(plan.expiresAt as string)
      const got = validatePlan(plan).success
      if (got) accepted++
      if (got !== expected) mismatches.push(plan)
    }
    expect(mismatches).toEqual([])
    expect(accepted).toBeGreaterThan(100) // the sweep exercises both outcomes
  })

  it('refuses unknown fields and a bad reference MVC', () => {
    expect(validatePlan({ ...base, frequencyHz: 60 }).success).toBe(false)
    for (const referenceMvc of [
      { ...base.referenceMvc, unit: 'uV' },
      { ...base.referenceMvc, value: 0 },
      { ...base.referenceMvc, value: -0.1 },
      { ...base.referenceMvc, recordedBy: 'Dr Jane Doe' },
    ]) {
      expect(validatePlan({ ...base, referenceMvc }).success).toBe(false)
    }
    expect(validatePlan({ ...base, patientId: 'name with spaces' }).success).toBe(false)
    expect(validatePlan({ ...base, version: 0 }).success).toBe(false)
  })
})

describe('isPlanExpired', () => {
  const expires = Date.parse(base.expiresAt)
  it('is valid until expiresAt and expired from then on', () => {
    expect(isPlanExpired(base, new Date(expires - 1))).toBe(false)
    expect(isPlanExpired(base, new Date(expires))).toBe(true)
    expect(isPlanExpired(base, new Date(expires + 1))).toBe(true)
  })
  it('fails closed on unreadable dates', () => {
    expect(isPlanExpired(base, new Date(NaN))).toBe(true)
    expect(isPlanExpired({ expiresAt: 'not a date' }, new Date(expires - 1))).toBe(true)
  })
})

describe('nextVersionOk', () => {
  it('needs a strictly higher whole version', () => {
    expect(nextVersionOk(null, 1)).toBe(true)
    expect(nextVersionOk(3, 4)).toBe(true)
    expect(nextVersionOk(3, 12)).toBe(true)
    for (const [prev, next] of [[null, 0], [3, 3], [3, 2], [3, 4.5], [3, NaN], [3, 2 ** 53]] as const) {
      expect(nextVersionOk(prev, next)).toBe(false)
    }
  })
})

describe('referenceMvcUpdateOk', () => {
  const ref = base.referenceMvc
  it('allows the first recording, the same recording, and a newer higher one', () => {
    expect(referenceMvcUpdateOk(null, ref)).toBe(true)
    expect(referenceMvcUpdateOk(ref, { ...ref })).toBe(true)
    expect(referenceMvcUpdateOk(ref, { ...ref, value: 0.4, recordedAt: '2026-02-27T10:00:00.000Z' })).toBe(true)
  })
  it('refuses any decrease, an equal re-recording, and a backdated higher value', () => {
    expect(referenceMvcUpdateOk(ref, { ...ref, value: 0.3, recordedAt: '2026-02-27T10:00:00.000Z' })).toBe(false)
    expect(referenceMvcUpdateOk(ref, { ...ref, recordedAt: '2026-02-27T10:00:00.000Z' })).toBe(false)
    expect(referenceMvcUpdateOk(ref, { ...ref, value: 0.4, recordedAt: '2026-02-10T10:00:00.000Z' })).toBe(false)
  })
})
