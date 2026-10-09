import type { Fact } from './facts'

// Steps 2 and 3 of the weekly report. Step 2 (an LLM call) is not wired up in this build: the report is a
// deterministic template over the facts, labelled "AI draft, demo data". Step 3, the guard, already runs on it
// and is the check any future LLM output must pass. Points are topics to review, never new parameter values.

export type Point = { text: string; factIds: string[] }
export type Report = { summary: string[]; points: Point[]; questions: string[]; source: 'template' }

const v = (facts: Fact[], id: string) => facts.find((f) => f.id === id)?.value ?? 'no data yet'
const n = (facts: Fact[], id: string) => Number.parseFloat(v(facts, id)) || 0

export function templateReport(facts: Fact[]): Report {
  const [done, planned] = v(facts, 'F1').split(' of ').map(Number) as [number, number]
  const summary = [
    `In the last 7 days, ${v(facts, 'F1')} planned sessions took place.`,
    `Mean comfort was ${v(facts, 'F2')} and mean pain was ${v(facts, 'F3')}.`,
    `Sessions with high pain: ${v(facts, 'F4')}. STOP presses: ${v(facts, 'F5')}. Other brace stops or degraded sessions: ${v(facts, 'F6')}.`,
    `Knee flexion, first to last session of the week: ${v(facts, 'F8')}.`,
  ]
  const points: Point[] = []
  if (n(facts, 'F4') > 0 || n(facts, 'F5') > 0) points.push({ text: 'Review the sessions with high pain or a STOP press before the next approval.', factIds: ['F4', 'F5'] })
  if (done < planned) points.push({ text: 'Discuss the sessions that did not take place this week.', factIds: ['F1'] })
  if (n(facts, 'F6') > 0) points.push({ text: 'Check the brace stops and degraded sessions in the safety log.', factIds: ['F6'] })
  if (v(facts, 'F11') === 'yes') points.push({ text: 'A simulated AI suggestion is waiting: decide each parameter on the Next session tab.', factIds: ['F11', 'F10'] })
  points.push({ text: 'Compare the knee flexion and activation trends with the charts.', factIds: ['F8', 'F9'] })
  const questions = [
    'How did the sessions fit into the day this week?',
    'Any problem with the brace, the straps or the electrodes?',
    ...(n(facts, 'F5') > 0 ? ['What happened just before the STOP press?'] : []),
  ]
  return { summary, points, questions, source: 'template' }
}

const CLAIMS = /(?<![\p{L}\p{N}_])(safe|safely|validated|certified|compliant|secure|secured|clinical-grade|clinically validated|medical[- ]grade|improves recovery|reduces pain|autonomous)(?![\p{L}\p{N}_])/iu

/** Rejects a report that cites a number not in the facts, uses a claim-register word, or cites an unknown fact. */
export function guardReport(r: Omit<Report, 'source'>, facts: Fact[]): { ok: true } | { ok: false; reason: string } {
  const known = new Set(facts.flatMap((f) => [f.value, f.label, f.id].join(' ').match(/\d+(?:\.\d+)?/g) ?? []))
  const text = [...r.summary, ...r.points.map((p) => p.text), ...r.questions].join(' ')
  const ids = new Set(facts.map((f) => f.id))
  const badNumber = (text.match(/\d+(?:\.\d+)?/g) ?? []).find((x) => !known.has(x))
  if (badNumber) return { ok: false, reason: `number not in the facts: ${badNumber}` }
  if (CLAIMS.test(text)) return { ok: false, reason: 'claim-register word' }
  const badId = r.points.flatMap((p) => p.factIds).find((id) => !ids.has(id))
  if (badId) return { ok: false, reason: `unknown fact ${badId}` }
  return { ok: true }
}
