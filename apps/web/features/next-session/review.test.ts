import { plans, sessions, suggestions } from '@symbiomed/fixtures'
import { validatePlan } from '@symbiomed/domain'
import { describe, expect, it } from 'vitest'
import { initialDraft, review, type Draft } from './review'

const plan = plans.at(-1)!
const s = { ...suggestions.at(-1)!, patientId: plan.patientId }
const last = { ...sessions.at(-1)!, pain: 1, safeStopCause: null }
const accept = (d: Draft): Draft => ({ ...d, choices: { ceilingMa: { action: 'accept', value: '', reason: '' }, offS: { action: 'accept', value: '', reason: '' }, contractions: { action: 'accept', value: '', reason: '' } } })

describe('next-session review', () => {
  it('is incomplete until every parameter has a decision', () => {
    const r = review(initialDraft(plan), plan, s, last, 'pr-001')
    expect([r.decided, r.complete, r.request]).toEqual([0, false, null])
  })

  it('builds an approval for the next version from accepted values', () => {
    const r = review(accept(initialDraft(plan)), plan, s, last, 'pr-001')
    expect(r.complete).toBe(true)
    expect(r.request?.version).toBe(plan.version + 1)
    expect(r.request?.decisions.map((d) => d.action)).toEqual(['accept', 'accept', 'accept'])
  })

  it('needs a reason and an in-range value to override, and never offers 55 mA', () => {
    const d = accept(initialDraft(plan))
    d.choices.ceilingMa = { action: 'override', value: '55', reason: '' }
    const r = review(d, plan, s, last, 'pr-001')
    expect(r.errors.ceilingMa).toMatch(/10 to 50/)
    expect(r.errors.ceilingMaReason).toMatch(/reason is required/)
    expect(r.complete).toBe(false)
    d.choices.ceilingMa = { action: 'override', value: String(s.ceilingMa.value - 2), reason: 'Keep it lower this week' }
    expect(review(d, plan, s, last, 'pr-001').complete).toBe(true)
  })

  it('refuses a lower reference MVC and records a raised one as a new recording', () => {
    const d = accept(initialDraft(plan))
    expect(review({ ...d, referenceMvc: String(plan.referenceMvc.value - 0.01) }, plan, s, last, 'pr-001').errors.referenceMvc).toBeDefined()
    const raised = review({ ...d, referenceMvc: String(plan.referenceMvc.value + 0.05) }, plan, s, last, 'pr-002', new Date('2026-03-01T08:00:00Z'))
    expect(raised.request?.plan.referenceMvc).toMatchObject({ recordedBy: 'pr-002', recordedAt: '2026-03-01T08:00:00.000Z' })
  })

  it('warns on a rise above 10 mA, on pain >= 4 and on a STOP press', () => {
    const d = accept(initialDraft({ ...plan, ceilingMa: 20 }))
    d.choices.ceilingMa = { action: 'override', value: '35', reason: 'Tolerated well at the clinic' }
    const r = review(d, { ...plan, ceilingMa: 20 }, s, { ...last, pain: 6, safeStopCause: 'stop-button' }, 'pr-001')
    expect(r.warnings).toHaveLength(3)
  })

  it('produces plans that pass the domain validation for every fixture suggestion', () => {
    for (const sug of suggestions.slice(0, 40)) {
      const p = plans.find((x) => x.patientId === sug.patientId)!
      const r = review(accept(initialDraft(p)), p, sug, null, 'pr-001')
      const { validityH, ...values } = r.request!.plan
      const issued = new Date().toISOString()
      expect(validatePlan({ ...values, planId: p.planId, patientId: p.patientId, version: p.version + 1, issuedAt: issued, expiresAt: new Date(Date.now() + validityH! * 3_600_000).toISOString(), approvedBy: 'pr-001', approvedAt: issued }).success).toBe(true)
    }
  })
})
