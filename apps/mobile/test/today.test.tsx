import { screen } from '@testing-library/react-native'
import { todayView } from '../src/logic'
import { TodayScreen } from '../src/screens/Today'
import { activePlan, fakeApi, patientSessions, renderScreen } from './render'

describe('Today', () => {
  it('shows the approved plan with big numbers and the time left', async () => {
    await renderScreen(<TodayScreen />)
    expect(await screen.findByText('Approved by your physiotherapist')).toBeTruthy()
    expect(screen.getByText(`${activePlan().contractions} contractions`)).toBeTruthy()
    expect(screen.getByText(`${activePlan().ceilingMa}\u00a0mA`)).toBeTruthy()
    expect(screen.getByText(/Valid for 19 h 5\d min more/)).toBeTruthy()
  })

  it('never shows an expired plan as current: no plan values, and the patient is told to contact the physiotherapist', async () => {
    const expired = activePlan({ expiresAt: new Date(Date.now() - 60_000).toISOString() })
    await renderScreen(<TodayScreen />, { api: fakeApi({ getPlan: async () => ({ plan: expired }) }) })
    expect(await screen.findByText('Plan expired')).toBeTruthy()
    expect(screen.getByText('The brace will not start a session with this plan. Contact your physiotherapist.')).toBeTruthy()
    expect(screen.queryByText('Approved by your physiotherapist')).toBeNull()
    expect(screen.queryByText(`${expired.contractions} contractions`)).toBeNull()
    expect(screen.queryByText(`${expired.ceilingMa}\u00a0mA`)).toBeNull()
    expect(screen.queryByText('Before your session')).toBeNull()
    // The view itself carries no plan once expired.
    expect(todayView(expired, patientSessions(), new Date())).toEqual({ kind: 'expired' })
    expect(todayView(expired, [], new Date(Date.parse(expired.expiresAt)))).toEqual({ kind: 'expired' })
  })

  it('says plainly when there is no plan', async () => {
    await renderScreen(<TodayScreen />, { api: fakeApi({ getPlan: async () => ({ plan: null }) }) })
    expect(await screen.findByText('No plan yet')).toBeTruthy()
    expect(screen.getByText('You do not have an approved plan. Contact your physiotherapist.')).toBeTruthy()
  })
})
