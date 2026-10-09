import type { ApiClient } from '@symbiomed/api-client'
import type { Plan, SessionSummary } from '@symbiomed/domain'
import { FIXTURE_NOW, patients, plans, sessions } from '@symbiomed/fixtures'

// DEMO ONLY (EXPO_PUBLIC_DEMO=1): the app runs on synthetic fixture data, in memory, with no server, sign-in
// or brace. Used to record the demo and to run the app in a browser. Never enabled in a real build.
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1'

const DAY = 86_400_000
/** Shift every ISO timestamp by whole days so the fixture's "now" falls on today (same idea as the web mock). */
const shift = Math.floor((Date.now() - Date.parse(FIXTURE_NOW)) / DAY) * DAY
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
function shifted<T>(x: T): T {
  if (typeof x === 'string' && ISO.test(x)) return new Date(Date.parse(x) + shift).toISOString() as T
  if (Array.isArray(x)) return x.map(shifted) as T
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shifted(v)])) as T
  return x
}

/** The demo patient: SYN-01, the typical mid-program profile. */
export const DEMO_PATIENT = patients[0]!.patientId
const mine = <T extends { patientId: string }>(xs: readonly T[]) => xs.filter((x) => x.patientId === DEMO_PATIENT).map(shifted)

let demoSessions: SessionSummary[] = mine(sessions)
// The newest session waits for a rating, so the demo can show the rating and the completion moment.
const last = demoSessions.at(-1)
if (last) demoSessions = [...demoSessions.slice(0, -1), { ...last, comfort: null, pain: null }]
const demoPlans: Plan[] = mine(plans)

const past = <T extends { startedAt?: string; issuedAt?: string }>(x: T) => Date.parse(x.startedAt ?? x.issuedAt ?? '') <= Date.now()

/** A fake of the BFF client: reads come from the fixtures, a rating updates the session in memory. */
export const demoApi = {
  getPlan: async () => ({ plan: demoPlans.filter(past).at(-1) ?? null }),
  getSessions: async () => ({ sessions: demoSessions.filter(past) }),
  postOutcome: async (_id: string, o: { sessionId: string; comfort: number; pain: number }) => {
    demoSessions = demoSessions.map((s) => (s.sessionId === o.sessionId ? { ...s, comfort: o.comfort, pain: o.pain } : s))
    return { session: demoSessions.find((s) => s.sessionId === o.sessionId)! }
  },
  postSession: async (_id: string, s: SessionSummary) => {
    demoSessions = [...demoSessions, s]
    return { session: s }
  },
} as unknown as ApiClient // the patient app calls only these four methods

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
/** An unsigned stand-in token carrying only the opaque patient ID (nothing verifies it in demo mode). */
export const demoToken = () => `${b64({ alg: 'none' })}.${b64({ patient_id: DEMO_PATIENT })}.demo`
