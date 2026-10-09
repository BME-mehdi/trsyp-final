import { PRACTITIONERS, patients } from '@symbiomed/fixtures'
import type { DevClaims } from '../server/dev-auth'

/** The same two demo users as the Keycloak realm (docker/keycloak/symbiomed-realm.json). */
export const DEMO_USERS = {
  clinician: { sub: 'demo-clinician', roles: ['clinician'], practitioner_id: PRACTITIONERS[0], amr: ['pwd', 'otp'] },
  patient: { sub: 'demo-patient', roles: ['patient'], patient_id: patients[0]!.patientId, amr: ['pwd'] },
} satisfies Record<string, DevClaims>

/** Demo sign-in for the mock identity provider: same passwords and TOTP secret as the Keycloak dev realm. */
export const DEMO_ACCOUNTS = {
  'clinician.demo': { password: 'demo-clinician', totpSecret: 'symbiomed-demo-totp-secret', claims: DEMO_USERS.clinician },
  'patient.demo': { password: 'demo-patient', totpSecret: null, claims: DEMO_USERS.patient },
} as const
