import { sessions as all, suggestions } from '@symbiomed/fixtures'
import { describe, expect, it } from 'vitest'
import { triage } from '../worklist/flags'
import { buildFacts } from './facts'
import { guardReport, templateReport } from './report'

const pid = all[0]!.patientId
const mine = all.filter((s) => s.patientId === pid)
const now = new Date(Date.parse(mine.at(-1)!.endedAt) + 3_600_000)

describe('weekly report (template, demo)', () => {
  const facts = buildFacts(mine, null, suggestions.find((s) => s.patientId === pid) ?? null, now)
  it('builds facts with IDs and never includes a free-text note', () => {
    expect(facts.map((f) => f.id)).toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'])
    expect(JSON.stringify(facts)).not.toMatch(/note/i)
  })
  it('the template passes its own guard and every point cites facts', () => {
    const r = templateReport(facts)
    expect(guardReport(r, facts)).toEqual({ ok: true })
    expect(r.points.every((p) => p.factIds.length > 0)).toBe(true)
    expect(r.summary.length).toBeGreaterThanOrEqual(3)
  })
  it('the guard rejects invented numbers, claim words and unknown facts', () => {
    const r = templateReport(facts)
    expect(guardReport({ ...r, summary: ['Raise the ceiling to 47 mA.'] }, facts).ok).toBe(false)
    expect(guardReport({ ...r, summary: ['The plan is safe.'] }, facts).ok).toBe(false)
    expect(guardReport({ ...r, points: [{ text: 'x', factIds: ['F99'] }] }, facts).ok).toBe(false)
  })
})

describe('worklist triage', () => {
  it('flags pain, STOP presses and plans expiring within 12 h, with text labels', () => {
    const s = { ...mine.at(-1)!, pain: 6, safeStopCause: 'stop-button' as const }
    const t = triage([s], { status: 'active', expiresAt: new Date(now.getTime() + 3_600_000).toISOString() }, now)
    expect(t.flags.map((f) => f.id)).toEqual(['high-pain', 'stop-press', 'expiring'])
    expect(t.flags.every((f) => f.label.length > 0)).toBe(true)
    expect(t.lastPain).toBe(6)
  })
  it('no flags and no score for a quiet week', () => {
    const t = triage([{ ...mine.at(-1)!, pain: 1, safeStopCause: null }], { status: 'active', expiresAt: new Date(now.getTime() + 30 * 3_600_000).toISOString() }, now)
    expect(t).toMatchObject({ flags: [], score: 0 })
  })
})
