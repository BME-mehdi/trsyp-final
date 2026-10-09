import type { ClampReason, ModelALabel, PlanParameter, SafeStopCause } from '@symbiomed/domain'
import type { CodeSystem, Coding } from 'fhir/r4'
import { BASE } from './terminology'

// The local CodeSystem file. Every code here is local because no exact standard code was
// confirmed; each one has a line in docs/TERMINOLOGY_TODO.md (a test checks that).
// Codes that come from the domain use `satisfies Record<...>`: a missing or extra code fails to compile.

export const OBSERVATION_CODES = {
  comfort: 'comfort-0-3',
  flexion: 'knee-flexion-max',
  activation: 'voluntary-activation',
  fatigue: 'fatigue-mdf-drop',
  peakCurrent: 'peak-delivered-current',
} as const

const DISPLAYS = {
  // TODO(terminology): candidate LOINC/SNOMED CT codes for flexion and activation, see docs/TERMINOLOGY_TODO.md
  observation: {
    'comfort-0-3': 'Session comfort rating, 0-3',
    'knee-flexion-max': 'Maximum knee flexion during the session',
    'voluntary-activation': 'Mean voluntary activation, % of reference MVC',
    'fatigue-mdf-drop': 'EMG median-frequency drop across the session',
    'peak-delivered-current': 'Peak delivered stimulation current',
  },
  // TODO(terminology): candidate device-problem codes (e.g. IMDRF Annex A), see docs/TERMINOLOGY_TODO.md
  'stop-cause': {
    'stop-button': 'STOP button pressed',
    usb: 'USB connected during stimulation',
    battery: 'Battery below threshold',
    watchdog: 'Watchdog timeout',
    'sensor-fault': 'Sensor fault or stale sensor data',
    'lead-off': 'Electrode lead-off or open circuit',
    'current-error': 'Current tracking error',
    'over-current': 'Over-current',
  } satisfies Record<SafeStopCause, string>,
  // TODO(terminology): project-specific, no standard equivalent expected
  'model-a-label': {
    under: 'Under-activated',
    'on-target': 'On target',
    fatigued: 'Fatigued',
    guarding: 'Guarding',
  } satisfies Record<ModelALabel, string>,
  // TODO(terminology): project-specific, no standard equivalent expected
  'plan-parameter': {
    ceilingMa: 'Intensity ceiling',
    offS: 'OFF time between contractions',
    contractions: 'Contractions per session',
  } satisfies Record<PlanParameter, string>,
  // TODO(terminology): project-specific, no standard equivalent expected
  'clamp-reason': {
    'max-increase': 'At most +10 mA per session',
    'pain-or-guarding': '-5 mA after pain >= 4/10 or guarding > 30 %',
    'stop-pressed': 'No increase after a STOP press',
    'ceiling-cap': '50 mA cap',
    'ceiling-min': '10 mA minimum',
    'not-allowed-value': 'Snapped to an allowed value',
  } satisfies Record<ClampReason, string>,
  // TODO(terminology): project-specific, no standard equivalent expected
  decision: { accept: 'AI suggestion accepted', override: 'AI suggestion overridden' },
  // TODO(terminology): project-specific, no standard equivalent expected
  'data-basis': { simulated: 'Simulated data' },
  // TODO(terminology): candidate SNOMED CT procedure code for NMES, see docs/TERMINOLOGY_TODO.md
  activity: { 'nmes-session': 'Seated isometric NMES session' },
} as const

export type LocalSystem = keyof typeof DISPLAYS
export const systemUrl = (name: LocalSystem) => `${BASE}/CodeSystem/${name}`
export const coding = (system: LocalSystem, code: string): Coding => ({ system: systemUrl(system), code })

/** The code of a coding from `system`, if any. */
export const codeOf = (c: Coding | undefined, system: LocalSystem): string | undefined =>
  c?.system === systemUrl(system) ? c.code : undefined

/** The code from the first coding of `system` in a list, if any. */
export const codeIn = (codings: Coding[] | undefined, system: LocalSystem): string | undefined =>
  codings?.find((c) => c.system === systemUrl(system))?.code

/** The local CodeSystems as FHIR resources, ready to load into the terminology server. */
export const LOCAL_CODE_SYSTEMS: CodeSystem[] = Object.entries(DISPLAYS).map(([name, concepts]) => ({
  resourceType: 'CodeSystem',
  id: `symbiomed-${name}`,
  url: systemUrl(name as LocalSystem),
  name: `SymbioMed_${name.replace(/-/g, '_')}`,
  status: 'draft',
  experimental: true,
  caseSensitive: true,
  content: 'complete',
  concept: Object.entries(concepts).map(([code, display]) => ({ code, display })),
}))
