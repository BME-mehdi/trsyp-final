import type { Plan } from '@symbiomed/domain'

export type Scenario = 'typical' | 'degraded-session' | 'pain-related-stop' | 'expired-plan' | 'low-adherence'
export type SessionEvent = 'degraded' | 'lead-off' | 'pain-stop'

/** Hidden traits of one synthetic patient. No names, no dates of birth. */
export type Profile = {
  label: string
  scenario: Scenario
  seed: number
  adherence: number // chance that a planned session happens
  mode: 0 | 1
  pulseWidthUs: number
  floorFraction: number
  mvcMv: number // first reference MVC, recorded at the clinic on day 2
  firstPlan: Pick<Plan, 'ceilingMa' | 'offS' | 'contractions'>
  toleranceMa: number // the simulated model stops raising the ceiling near this value
  bigStepDay?: number // the model overshoots once on this day (shows the +10 mA clamp)
  activation: [day2: number, week6: number] // mean voluntary activation, % of reference MVC
  flexion: [day2: number, week6: number] // degrees
  lastApprovalDay: number // the clinician approves daily up to this day
  events: Record<string, SessionEvent> // key `${day}-${slot}`, slot 0 = morning, 1 = afternoon
}

export const PROFILES: Profile[] = [
  {
    label: 'SYN-01', scenario: 'typical', seed: 101, adherence: 0.95, mode: 1, pulseWidthUs: 250, floorFraction: 0.6,
    mvcMv: 0.32, firstPlan: { ceilingMa: 20, offS: 60, contractions: 10 }, toleranceMa: 42, bigStepDay: 6,
    activation: [14, 36], flexion: [62, 118], lastApprovalDay: 43, events: {},
  },
  {
    label: 'SYN-02', scenario: 'degraded-session', seed: 202, adherence: 0.9, mode: 1, pulseWidthUs: 300, floorFraction: 0.6,
    mvcMv: 0.28, firstPlan: { ceilingMa: 22, offS: 60, contractions: 10 }, toleranceMa: 58,
    activation: [12, 33], flexion: [58, 112], lastApprovalDay: 43, events: { '20-1': 'degraded', '27-0': 'lead-off' },
  },
  {
    label: 'SYN-03', scenario: 'pain-related-stop', seed: 303, adherence: 0.92, mode: 1, pulseWidthUs: 250, floorFraction: 0.6,
    mvcMv: 0.3, firstPlan: { ceilingMa: 18, offS: 60, contractions: 10 }, toleranceMa: 38,
    activation: [13, 34], flexion: [60, 115], lastApprovalDay: 42, events: { '42-1': 'pain-stop' },
  },
  {
    label: 'SYN-04', scenario: 'expired-plan', seed: 404, adherence: 0.9, mode: 1, pulseWidthUs: 250, floorFraction: 0.7,
    mvcMv: 0.26, firstPlan: { ceilingMa: 20, offS: 60, contractions: 10 }, toleranceMa: 40,
    activation: [11, 31], flexion: [55, 108], lastApprovalDay: 40, events: {},
  },
  {
    label: 'SYN-05', scenario: 'low-adherence', seed: 505, adherence: 0.65, mode: 0, pulseWidthUs: 250, floorFraction: 1.0,
    mvcMv: 0.24, firstPlan: { ceilingMa: 16, offS: 60, contractions: 10 }, toleranceMa: 30,
    activation: [8, 24], flexion: [50, 98], lastApprovalDay: 43, events: {},
  },
]
