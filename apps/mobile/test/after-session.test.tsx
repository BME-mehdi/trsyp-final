import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { outcomeOk } from '../src/logic'
import { AfterSessionScreen } from '../src/screens/AfterSession'
import { fakeApi, patientSessions, renderScreen } from './render'

const unrated = () => {
  const s = patientSessions()
  const last = { ...s.at(-1)!, comfort: null, pain: null }
  return [...s.slice(0, -1), last]
}

describe('After session', () => {
  it('needs comfort and pain before sending, and sends them with the note', async () => {
    const api = fakeApi({ getSessions: async () => ({ sessions: unrated() }) })
    await renderScreen(<AfterSessionScreen />, { api })
    const submit = await screen.findByTestId('submit')
    expect(submit).toBeDisabled()
    await fireEvent.press(screen.getByTestId('comfort-2'))
    expect(screen.getByTestId('submit')).toBeDisabled()
    await fireEvent(screen.getByTestId('pain-slider'), 'valueChange', 3)
    expect(screen.getByText('Pain: 3 out of 10')).toBeTruthy()
    await fireEvent.changeText(screen.getByTestId('note'), 'Felt tired today')
    expect(screen.getByText('16 of 200 characters')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('submit'))
    await waitFor(() => expect(api.postOutcome).toHaveBeenCalledWith(unrated().at(-1)!.patientId, { sessionId: unrated().at(-1)!.sessionId, comfort: 2, pain: 3, note: 'Felt tired today' }))
    expect(await screen.findByText('Thank you. Your answers are saved.')).toBeTruthy()
  })

  it('cannot produce or submit values outside 0–3 and 0–10', async () => {
    await renderScreen(<AfterSessionScreen />, { api: fakeApi({ getSessions: async () => ({ sessions: unrated() }) }) })
    await screen.findByTestId('submit')
    for (let i = 0; i < 15; i++) await fireEvent.press(screen.getByText('Higher'))
    expect(screen.getByText('Pain: 10 out of 10')).toBeTruthy()
    for (let i = 0; i < 15; i++) await fireEvent.press(screen.getByText('Lower'))
    expect(screen.getByText('Pain: 0 out of 10')).toBeTruthy()
    await fireEvent(screen.getByTestId('pain-slider'), 'valueChange', 14)
    expect(screen.getByText('Pain: 10 out of 10')).toBeTruthy()
    await fireEvent(screen.getByTestId('pain-slider'), 'valueChange', 4.6)
    expect(screen.getByText('Pain: 5 out of 10')).toBeTruthy()
    expect(screen.getByText(/If you have pain or burning/)).toBeTruthy()
    expect(screen.queryByTestId('comfort-4')).toBeNull()

    const id = unrated().at(-1)!.sessionId
    expect(outcomeOk({ sessionId: id, comfort: 2, pain: 3, note: '' })).toBe(true)
    for (const bad of [{ comfort: 4, pain: 3 }, { comfort: -1, pain: 3 }, { comfort: 2, pain: 11 }, { comfort: 2, pain: -1 }, { comfort: 2, pain: 3.5 }, { comfort: null, pain: 3 }, { comfort: 2, pain: null }]) {
      expect(outcomeOk({ sessionId: id, note: '', ...bad })).toBe(false)
    }
    expect(outcomeOk({ sessionId: id, comfort: 2, pain: 3, note: 'x'.repeat(201) })).toBe(false)
  })

  it('says so when there is nothing to rate', async () => {
    await renderScreen(<AfterSessionScreen />)
    expect(await screen.findByText('There is no new session to rate.')).toBeTruthy()
  })
})
