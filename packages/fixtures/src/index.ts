import { NOW_MS, generatePatient } from './generate'
import { PROFILES } from './profiles'

export { PRACTITIONERS } from './generate'
export type { Scenario } from './profiles'

/** "Now" for every fixture: day 43 (last day of week 6), 12:00 UTC on the synthetic calendar. */
export const FIXTURE_NOW = new Date(NOW_MS).toISOString()

const generated = PROFILES.map(generatePatient)

export const patients = generated.map(({ patientId, label, scenario, surgeryAt }) => ({ patientId, label, scenario, surgeryAt }))
export const braces = generated.map((g) => g.brace)
export const plans = generated.flatMap((g) => g.plans)
export const suggestions = generated.flatMap((g) => g.suggestions)
export const decisions = generated.flatMap((g) => g.decisions)
export const sessions = generated.flatMap((g) => g.sessions)
export { generatePatient, PROFILES }
