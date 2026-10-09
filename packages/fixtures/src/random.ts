// Seeded helpers: the fixtures are generated, not stored, and identical on every run.
export type Rng = () => number

/** mulberry32: small, fast, deterministic PRNG. Not for anything security-related. */
export function mulberry32(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo)
export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)] as T
export const round1 = (x: number) => Math.round(x * 10) / 10
export const round2 = (x: number) => Math.round(x * 100) / 100
export const hex = (rng: Rng, n: number) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join('')

/** Version-4 UUID layout filled from the seeded PRNG. */
export function uuid(rng: Rng): string {
  const h = hex(rng, 32).split('')
  h[12] = '4'
  h[16] = pick(rng, ['8', '9', 'a', 'b'])
  const s = h.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}
