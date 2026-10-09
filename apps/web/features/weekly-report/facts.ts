import { LIMITS, safetyEvents, type AiSuggestion, type Plan, type SessionSummary } from '@symbiomed/domain'

// Step 1 of the weekly report: a facts object built in code from the patient's data. Opaque ID only;
// the patient's free-text note is never included. Each fact has an ID that report points cite.

const WEEK = 7 * 24 * 3_600_000
export type FactLink = 'sessions' | 'safety' | 'charts' | ''
export type Fact = { id: string; label: string; value: string; link: FactLink }

const mean = (xs: number[]) => (xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : null)
const meanAv = (s: SessionSummary) => mean(s.perContraction.map((c) => c.aV))

export function buildFacts(sessions: readonly SessionSummary[], plan: Plan | null, suggestion: AiSuggestion | null, now: Date): Fact[] {
  const week = sessions.filter((s) => now.getTime() - Date.parse(s.startedAt) < WEEK)
  const ev = safetyEvents(week)
  const comfort = mean(week.flatMap((s) => (s.comfort === null ? [] : [s.comfort])))
  const pain = mean(week.flatMap((s) => (s.pain === null ? [] : [s.pain])))
  const first = week[0], last = week.at(-1)
  const avFirst = first ? meanAv(first) : null, avLast = last ? meanAv(last) : null
  const none = 'no data yet'
  return [
    { id: 'F1', label: 'Sessions in the last 7 days', value: `${week.length} of ${7 * LIMITS.sessionsPerDay}`, link: 'sessions' },
    { id: 'F2', label: 'Mean comfort (0–3)', value: comfort === null ? none : String(comfort), link: 'sessions' },
    { id: 'F3', label: 'Mean pain (0–10)', value: pain === null ? none : String(pain), link: 'sessions' },
    { id: 'F4', label: `Sessions with pain ${LIMITS.ai.painThreshold}/10 or more`, value: String(ev.filter((e) => e.kind === 'high-pain').length), link: 'safety' },
    { id: 'F5', label: 'STOP presses', value: String(ev.filter((e) => e.kind === 'stop-pressed').length), link: 'safety' },
    { id: 'F6', label: 'Other brace stops or degraded sessions', value: String(ev.filter((e) => e.kind === 'device-stop' || e.kind === 'degraded').length), link: 'safety' },
    { id: 'F7', label: 'Rest-day requests', value: 'not recorded yet (demo feature)', link: '' },
    { id: 'F8', label: 'Knee flexion, first to last session', value: first && last && week.length > 1 ? `${Math.round(first.flexionMaxDeg)}° to ${Math.round(last.flexionMaxDeg)}°` : none, link: 'charts' },
    { id: 'F9', label: 'Mean activation (% reference MVC), first to last session', value: avFirst !== null && avLast !== null && week.length > 1 ? `${avFirst} to ${avLast}` : none, link: 'charts' },
    { id: 'F10', label: 'Current plan', value: plan ? `v${plan.version}: ${plan.ceilingMa} mA ceiling, ${plan.contractions} contractions, ${plan.offS} s rest` : 'none', link: '' },
    { id: 'F11', label: 'AI suggestion waiting for review (simulated)', value: suggestion ? 'yes' : 'no', link: '' },
  ]
}
