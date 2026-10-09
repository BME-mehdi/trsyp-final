import { LIMITS, type SessionSummary } from '@symbiomed/domain'

// Small, subject-specific marks for the worklist. Both are decorative: the numbers are written next to them.

const DAY = 86_400_000

/** Seven days, two marks a day, like a session attendance sheet: filled = a session took place. */
export function SessionTally({ sessions, now }: { sessions: readonly SessionSummary[]; now: Date }) {
  const start = new Date(now.getTime() - 6 * DAY)
  start.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => {
    const from = start.getTime() + i * DAY
    return sessions.filter((s) => { const t = Date.parse(s.startedAt); return t >= from && t < from + DAY }).length
  })
  return (
    <svg viewBox="0 0 98 30" className="h-[30px] w-[98px] shrink-0" aria-hidden="true">
      {days.map((n, d) => Array.from({ length: LIMITS.sessionsPerDay }, (_, k) => (
        <rect key={`${d}-${k}`} x={d * 14 + 1} y={k * 15 + 1} width="11" height="12" rx="2"
          className={k < n ? 'fill-accent' : 'fill-none stroke-control'} strokeWidth="1.25" />
      )))}
    </svg>
  )
}

/** A quarter-to-three-quarter arc from 0° to 140°: the knee-bend reading, with a tick at the goal. */
export function KneeArc({ deg, goal }: { deg: number; goal: number }) {
  const r = 18, cx = 22, cy = 22, max = 140
  const pt = (v: number) => { const a = Math.PI * (1 - Math.min(v, max) / max); return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const }
  const [x, y] = pt(deg)
  const [gx1, gy1] = pt(goal)
  const gx2 = cx + (gx1 - cx) * 0.62, gy2 = cy + (gy1 - cy) * 0.62
  return (
    <svg viewBox="0 0 44 26" className="h-[26px] w-[44px] shrink-0" aria-hidden="true">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} className="fill-none stroke-divider" strokeWidth="4" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`} className="fill-none stroke-accent" strokeWidth="4" strokeLinecap="round" />
      <line x1={gx1} y1={gy1} x2={gx2} y2={gy2} className="stroke-ink" strokeWidth="1.5" />
    </svg>
  )
}
