import type { Plan, SessionSummary } from '@symbiomed/domain'

// Golden inputs for the wire format. Their bytes are checked in (golden.test.ts); a change to the
// format makes those tests fail on purpose. Share these with the firmware team as reference frames.
export const GOLDEN_PLAN: Plan = {
  planId: '3f1d5c7e-8a2b-4c6d-9e0f-1a2b3c4d5e6f',
  patientId: 'pt-2c8a6b9f',
  version: 12,
  issuedAt: '2026-10-09T07:30:00.000Z',
  expiresAt: '2026-10-10T19:30:00.000Z',
  pulseWidthUs: 250,
  ceilingMa: 30,
  floorFraction: 0.6,
  offS: 45,
  contractions: 10,
  aTargetPctMvc: 30,
  referenceMvc: { value: 0.35, unit: 'mV', recordedAt: '2026-10-01T10:00:00.000Z', recordedBy: 'pr-001' },
  approvedBy: 'pr-001',
  approvedAt: '2026-10-09T07:30:00.000Z',
}

export const GOLDEN_SESSION: SessionSummary = {
  sessionId: '5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
  patientId: 'pt-2c8a6b9f',
  planId: '3f1d5c7e-8a2b-4c6d-9e0f-1a2b3c4d5e6f',
  planVersion: 12,
  firmwareVersion: '1.4.0',
  startedAt: '2026-10-09T08:00:00.000Z',
  endedAt: '2026-10-09T08:21:00.000Z',
  mode: 1,
  degraded: false,
  contractionsDone: 2,
  peakDeliveredMa: 21.4,
  meanDeliveredMa: 19.9,
  perContraction: [
    { index: 0, aV: 28.4, commandedMa: 18, peakMa: 18.3, modelALabel: 'on-target' },
    { index: 1, aV: 22.1, commandedMa: 21, peakMa: 21.4, modelALabel: 'under' },
  ],
  fatigueMdfDropPct: 9.5,
  flexionMaxDeg: 84.5,
  safeStopCause: 'lead-off',
  comfort: null,
  pain: null,
}
