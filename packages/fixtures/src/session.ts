import { LIMITS, SessionSummarySchema, type Contraction, type ModelALabel, type Plan, type SessionSummary } from '@symbiomed/domain'
import type { Profile, SessionEvent } from './profiles'
import { between, pick, round1, uuid, type Rng } from './random'

export const FIRMWARE = '1.4.0'
const ATTEMPT_S = 3 // stimulator off, the patient pushes (spec VI.3)
const CURRENT_S = LIMITS.rampUpS + LIMITS.holdS + LIMITS.rampDownS
const SELF_TEST_S = 60

/** One simulated session summary, as the brace would report it plus the patient's ratings. */
export function makeSession(rng: Rng, p: Profile, plan: Plan, day: number, start: number, event: SessionEvent | null): SessionSummary {
  const n = event === 'pain-stop' ? 5 : event === 'lead-off' ? 8 : plan.contractions
  const floor = plan.floorFraction * plan.ceilingMa
  const target = plan.aTargetPctMvc
  const activation = p.activation[0] + (p.activation[1] - p.activation[0]) * (1 - Math.exp(-day / 12))
  const rows: Contraction[] = []
  let cmd = floor // the first contraction of a session uses the floor
  for (let k = 0; k < n; k++) {
    const aV = round1(Math.max(0, activation + between(rng, -6, 6)))
    const fallback = event === 'degraded' && k >= 4 // EMG invalid: Mode 0 at the floor
    let label: ModelALabel = aV < 0.8 * target ? 'under' : 'on-target'
    if (k >= 0.7 * n && rng() < 0.3) label = 'fatigued'
    if (event === 'pain-stop' && k === n - 1) label = 'guarding'
    if (k > 0 && p.mode === 1 && !fallback && label !== 'fatigued') {
      // Assist rule (spec VI.2), simplified: toward the target, at most 3 mA per contraction.
      const step = Math.min(3, Math.abs(target - aV) * 0.25)
      cmd = Math.min(plan.ceilingMa, Math.max(floor, cmd + (aV < target ? step : -step)))
    }
    if (fallback) cmd = floor
    const commandedMa = round1(cmd)
    rows.push({ index: k, aV, commandedMa, peakMa: round1(commandedMa * between(rng, 0.97, 1.03)), modelALabel: label })
  }
  const peaks = rows.map((r) => r.peakMa)
  const durationS = SELF_TEST_S + n * (ATTEMPT_S + CURRENT_S) + (n - 1) * plan.offS
  const skipped = event !== 'pain-stop' && rng() < 0.03 // the patient skipped the ratings
  const weeks = Math.min(1, (day - 2) / 41) ** 0.6
  return SessionSummarySchema.parse({
    sessionId: uuid(rng),
    patientId: plan.patientId,
    planId: plan.planId,
    planVersion: plan.version,
    firmwareVersion: FIRMWARE,
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(start + durationS * 1000).toISOString(),
    mode: p.mode,
    degraded: event === 'degraded',
    contractionsDone: n,
    peakDeliveredMa: Math.max(...peaks),
    meanDeliveredMa: round1(peaks.reduce((a, b) => a + b, 0) / n),
    perContraction: rows,
    fatigueMdfDropPct: event === 'degraded' ? null : round1(between(rng, 4, 18)),
    flexionMaxDeg: round1(p.flexion[0] + (p.flexion[1] - p.flexion[0]) * weeks + between(rng, -2, 2)),
    safeStopCause: event === 'pain-stop' ? 'stop-button' : event === 'lead-off' ? 'lead-off' : null,
    comfort: event === 'pain-stop' ? 0 : skipped ? null : pick(rng, [3, 3, 3, 3, 3, 2, 2, 2, 2, 1]),
    pain: event === 'pain-stop' ? 6 : skipped ? null : pick(rng, [0, 0, 0, 0, 1, 1, 1, 2, 2, 3]),
  })
}
