import { MockTransport } from '@symbiomed/brace-protocol'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { BraceScreen } from '../src/screens/Brace'
import { activePlan, fakeApi, patientSessions, PATIENT, renderScreen } from './render'

describe('Brace', () => {
  it.each([
    ['connected', 'Connected'],
    ['disconnected', 'Not connected'],
    ['searching', 'Looking for your brace…'],
    ['syncing', 'Syncing…'],
  ] as const)('shows the %s state in words', async (link, label) => {
    await renderScreen(<BraceScreen />, { brace: { link } })
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('shows the last sync, the plan version on the brace and waiting uploads', async () => {
    await renderScreen(<BraceScreen />, { brace: { link: 'connected', lastSyncAt: '2026-10-09T08:00:00.000Z', planVersionOnBrace: 42, pendingUploads: 2 } })
    expect(screen.getByText(/Last sync:/)).toBeTruthy()
    expect(screen.getByText('Plan on the brace: version 42')).toBeTruthy()
    expect(screen.getByText('Sessions waiting to upload: 2')).toBeTruthy()
  })

  it('sync: uploads the sessions stored on the brace, then sends the approved plan', async () => {
    const stored = { ...patientSessions().at(-1)!, comfort: null, pain: null }
    const t = new MockTransport({ patientId: PATIENT, sessions: [stored] })
    const api = fakeApi()
    await renderScreen(<BraceScreen />, { transport: t, api })
    await fireEvent.press(screen.getByTestId('sync'))
    await waitFor(() => expect(screen.getByTestId('brace-message')).toHaveTextContent(`Sessions sent: 1 Plan version ${activePlan().version} sent to the brace`))
    expect(api.postSession).toHaveBeenCalledWith(PATIENT, stored)
    expect(t.brace.sessions).toEqual([])
    expect(t.brace.plan?.version).toBe(activePlan().version)
    expect(screen.getByText(`Plan on the brace: version ${activePlan().version}`)).toBeTruthy()
  })

  it('sync: an expired plan is refused in the app and never written to the brace', async () => {
    const t = new MockTransport({ patientId: PATIENT })
    const expired = activePlan({ expiresAt: new Date(Date.now() - 60_000).toISOString(), issuedAt: new Date(Date.now() - 20 * 3_600_000).toISOString() })
    await renderScreen(<BraceScreen />, { transport: t, api: fakeApi({ getPlan: async () => ({ plan: expired }) }) })
    await fireEvent.press(screen.getByTestId('sync'))
    await waitFor(() => expect(screen.getByTestId('brace-message')).toHaveTextContent(/The brace will not start a session with this plan\./))
    expect(t.brace.plan).toBeNull()
    expect(t.writes).toBe(1) // the session request only
  })

  it('sync: a link lost mid-transfer is reported, not retried', async () => {
    const t = new MockTransport({ patientId: PATIENT, failure: { disconnectAfterBytes: 60 } })
    await renderScreen(<BraceScreen />, { transport: t })
    await fireEvent.press(screen.getByTestId('sync'))
    await waitFor(() => expect(screen.getByTestId('brace-message')).toHaveTextContent(/The connection was lost during the transfer\. The brace keeps its last approved plan\./))
    expect([t.writes, t.brace.plan]).toEqual([2, null])
  })
})
