// Single source of the limits in docs/CONTRACT.md §1. The brace firmware and the backend
// enforce them as well: UI validation is a convenience and never the only check.
// Values marked "to confirm" are listed in docs/OPEN_QUESTIONS.md.
export const LIMITS = {
  frequencyHz: 50, // fixed, display only
  pulseWidthUs: { min: 150, max: 400, default: 250, step: 1 }, // step: whole µs assumed, to confirm
  rampUpS: 3, // fixed, display only
  holdS: 15,
  rampDownS: 2,
  offS: { allowed: [30, 45, 60, 90] },
  contractions: { allowed: [10, 15, 20] },
  ceilingMa: { min: 10, max: 50, step: 1 }, // cap from decision D-02; integer step assumed, to confirm
  floorFraction: { min: 0.4, max: 1.0, default: 0.6 }, // 1.0 = fixed dose
  aTargetPctMvc: { min: 30, max: 30, default: 30 }, // range to confirm: fixed at the default until then
  validityH: { min: 12, max: 168, default: 36 },
  sessionsPerDay: 2, // enforced by the brace; the app only displays
  minGapH: 3,
  ai: {
    maxIncreaseMaPerSession: 10,
    decreaseMaAfterPainOrGuarding: -5,
    painThreshold: 4, // pain >= 4/10, design value to confirm
    guardingPctThreshold: 30, // guarding > 30 % of contractions
  },
  comfort: { min: 0, max: 3 },
  pain: { min: 0, max: 10 },
  kneeTargetDeg: 60, // display only
  gateDeg: 10,
  referenceMvcUnit: 'mV',
} as const
