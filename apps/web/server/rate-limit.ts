import { config } from './config'
import { HttpError } from './errors'

// ponytail: in-memory fixed window per process; move to a shared store (e.g. Redis) when the BFF runs on more than one instance.
const windows = new Map<string, { start: number; count: number }>()

export function rateLimit(key: string, now = Date.now()) {
  const limit = config().RATE_LIMIT_PER_MINUTE
  const w = windows.get(key)
  if (!w || now - w.start >= 60_000) {
    windows.set(key, { start: now, count: 1 })
    return
  }
  if (++w.count > limit) {
    throw new HttpError(429, 'rate_limited', 'Too many requests; try again in a minute', { headers: { 'retry-after': String(Math.ceil((w.start + 60_000 - now) / 1000)) } })
  }
}
