import { PRACTITIONERS, patients } from '@symbiomed/fixtures'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEMO_USERS } from '../mocks/demo-users'

const realm = JSON.parse(readFileSync(new URL('../../../docker/keycloak/symbiomed-realm.json', import.meta.url), 'utf8')) as {
  users: { username: string; realmRoles: string[]; attributes: Record<string, string[]>; requiredActions?: string[]; credentials: { type: string }[] }[]
  clients: { clientId: string; publicClient: boolean; directAccessGrantsEnabled: boolean; attributes?: Record<string, string> }[]
}
const user = (name: string) => realm.users.find((u) => u.username === name)!

describe('Keycloak demo realm', () => {
  it('links the demo users to the fixtures, as the mock-mode tokens do', () => {
    expect(user('patient.demo').attributes.patient_id).toEqual([patients[0]!.patientId])
    expect(user('clinician.demo').attributes.practitioner_id).toEqual([PRACTITIONERS[0]])
    expect(DEMO_USERS.patient.patient_id).toBe(patients[0]!.patientId)
    expect(DEMO_USERS.clinician.practitioner_id).toBe(PRACTITIONERS[0])
  })
  it('gives the clinician a second factor and the apps PKCE without password grants', () => {
    expect(user('clinician.demo').credentials.map((c) => c.type)).toContain('otp')
    for (const id of ['symbiomed-web', 'symbiomed-mobile']) {
      const c = realm.clients.find((x) => x.clientId === id)!
      expect([c.directAccessGrantsEnabled, c.attributes?.['pkce.code.challenge.method']]).toEqual([false, 'S256'])
    }
  })
})
