import type { SessionSummary } from '@symbiomed/domain'
import { describe, expect, it } from 'vitest'
import { GOLDEN_PLAN, GOLDEN_SESSION } from './golden'
import { BraceLink, MockTransport, encodePlan, toWirePlan, type Failure } from './index'

const NOW = new Date('2026-10-09T12:00:00Z')
const PATIENT = GOLDEN_PLAN.patientId
const ctx = { patientId: PATIENT, lastVersionOnBrace: 11, now: NOW }
const previous = toWirePlan({ ...GOLDEN_PLAN, version: 11 })

async function setup(failure: Failure = {}, sessions: SessionSummary[] = []) {
  const t = new MockTransport({ patientId: PATIENT, plan: previous, sessions, failure, now: () => NOW })
  await t.connect()
  return { t, link: new BraceLink(t, 100) }
}

describe('sending a plan', () => {
  it('delivers an approved, unexpired plan of the signed-in patient', async () => {
    const { t, link } = await setup()
    expect(await link.sendPlan(GOLDEN_PLAN, ctx)).toEqual({ status: 'accepted', version: 12 })
    expect(t.brace.plan).toEqual(toWirePlan(GOLDEN_PLAN))
  })

  it.each([
    ['expired', { ...GOLDEN_PLAN, expiresAt: '2026-10-09T11:00:00.000Z', issuedAt: '2026-10-08T07:30:00.000Z' }, ctx, 'expired'],
    ['for another patient', GOLDEN_PLAN, { ...ctx, patientId: 'pt-other' }, 'wrong-patient'],
    ['with a lower version than the brace has', { ...GOLDEN_PLAN, version: 10 }, ctx, 'older-version'],
    ['not approved (no valid approval fields)', { ...GOLDEN_PLAN, approvedBy: '' }, ctx, 'not-approved'],
    ['outside the limits', { ...GOLDEN_PLAN, ceilingMa: 55 }, ctx, 'not-approved'],
  ] as const)('refuses a plan %s in the app, before writing any byte', async (_n, plan, c, reason) => {
    const { t, link } = await setup()
    expect(await link.sendPlan(plan, c)).toEqual({ status: 'refused', reason })
    expect([t.writes, t.brace.plan]).toEqual([0, previous])
  })

  it('reports the brace refusing a lower version when the app check is out of date', async () => {
    const { t, link } = await setup()
    t.brace.plan = toWirePlan({ ...GOLDEN_PLAN, version: 15 }) // the app thinks the brace has v11
    expect(await link.sendPlan(GOLDEN_PLAN, ctx)).toEqual({ status: 'rejected', reason: 'older-version' })
    expect(t.brace.plan?.version).toBe(15)
  })

  it('stops after a disconnect mid-transfer, does not retry, and the brace keeps its last valid plan', async () => {
    const { t, link } = await setup({ disconnectAfterBytes: 60 })
    const total = encodePlan(GOLDEN_PLAN).length
    expect(await link.sendPlan(GOLDEN_PLAN, ctx)).toEqual({ status: 'interrupted', bytesSent: 60, total })
    expect([t.writes, t.connected, t.brace.plan]).toEqual([1, false, previous])
    // The UI decides to try again; after reconnecting, the brace has dropped the partial frame.
    await t.connect()
    expect(await link.sendPlan(GOLDEN_PLAN, ctx)).toEqual({ status: 'accepted', version: 12 })
  })

  it('reports a frame damaged in transit as rejected by the brace (CRC)', async () => {
    const { t, link } = await setup({ corruptByteAt: 100 })
    expect(await link.sendPlan(GOLDEN_PLAN, ctx)).toEqual({ status: 'rejected', reason: 'crc' })
    expect(t.brace.plan).toEqual(previous)
  })

  it('reports a brace that does not answer', async () => {
    const { link } = await setup({ silent: true })
    expect(await link.sendPlan(GOLDEN_PLAN, ctx)).toEqual({ status: 'no-reply' })
  })
})

describe('session sync', () => {
  const second = { ...GOLDEN_SESSION, sessionId: '6e7f8091-2b3c-4d5e-9f60-6b7c8d9e0f1a' }

  it('uploads each session and only then lets the brace delete it', async () => {
    const { t, link } = await setup({}, [GOLDEN_SESSION, second])
    const uploaded: string[] = []
    expect(await link.syncSessions(async (s) => void uploaded.push(s.sessionId))).toEqual({ uploaded: 2, problem: null })
    expect(uploaded).toEqual([GOLDEN_SESSION.sessionId, second.sessionId])
    expect(t.brace.sessions).toEqual([])
  })

  it('keeps a session on the brace when its upload fails', async () => {
    const { t, link } = await setup({}, [GOLDEN_SESSION, second])
    let n = 0
    const r = await link.syncSessions(async () => {
      if (n++ === 1) throw new Error('offline')
    })
    expect(r).toEqual({ uploaded: 1, problem: 'upload' })
    expect(t.brace.sessions.map((s) => s.sessionId)).toEqual([second.sessionId])
  })

  it('reports a link that drops before the request is sent', async () => {
    const { link } = await setup({ disconnectAfterBytes: 3 }, [GOLDEN_SESSION])
    expect(await link.syncSessions(async () => undefined)).toEqual({ uploaded: 0, problem: 'interrupted' })
  })
})
