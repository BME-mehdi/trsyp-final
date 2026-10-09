import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { clearRestDays } from '../src/rest'
import { AfterSessionScreen } from '../src/screens/AfterSession'
import { TodayScreen } from '../src/screens/Today'
import { fakeApi, patientSessions, renderScreen } from './render'

const unrated = () => {
  const s = patientSessions()
  return [...s.slice(0, -1), { ...s.at(-1)!, comfort: null, pain: null }]
}

describe('Today (gamified)', () => {
  beforeEach(() => clearRestDays())

  it('shows the rings with text, one next action and the STOP guidance chip', async () => {
    await renderScreen(<TodayScreen />)
    expect(await screen.findByText('Session 1')).toBeTruthy()
    expect(screen.getByText('Rating')).toBeTruthy()
    expect(screen.getByText('Get ready for session 1')).toBeTruthy()
    expect(screen.getByText('To stop: red STOP button on the brace')).toBeTruthy()
  })

  it('offers rating first when the newest session is unrated', async () => {
    await renderScreen(<TodayScreen />, { api: fakeApi({ getSessions: async () => ({ sessions: unrated() }) }) })
    expect(await screen.findByText('Rate your last session')).toBeTruthy()
  })

  it('rest day: pain shows the guidance, the request is labelled demo and never changes the plan', async () => {
    const api = fakeApi()
    await renderScreen(<TodayScreen />, { api })
    await fireEvent.press(await screen.findByTestId('rest-open'))
    await fireEvent.press(screen.getByTestId('rest-pain'))
    expect(screen.getByText('Pain or burning')).toBeTruthy()
    expect(screen.getByText(/Demo: saved in the app only/)).toBeTruthy()
    await fireEvent.press(screen.getByTestId('rest-confirm'))
    expect(await screen.findByText(/Rest day noted/)).toBeTruthy()
    expect(screen.getByText('Your plan stays the same.')).toBeTruthy()
    expect(api.calls.filter((c) => c !== 'getPlan' && c !== 'getSessions')).toEqual([])
  })
})

describe('Completion moment', () => {
  const rate = async (pain: number) => {
    const api = fakeApi({ getSessions: async () => ({ sessions: unrated() }) })
    await renderScreen(<AfterSessionScreen />, { api })
    await fireEvent.press(await screen.findByTestId('comfort-2'))
    await fireEvent(screen.getByTestId('pain-slider'), 'valueChange', pain)
    await fireEvent.press(screen.getByTestId('submit'))
    await waitFor(() => expect(screen.getByText('Thank you. Your answers are saved.')).toBeTruthy())
  }
  it('celebrates a rating with one sentence and a light haptic', async () => {
    ;(Haptics.impactAsync as jest.Mock).mockClear()
    await rate(2)
    expect(screen.getByText(/Rating sent\. Sessions today:/)).toBeTruthy()
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1)
  })
  it('pain 4/10 or more: no celebration, the high-pain guidance instead', async () => {
    ;(Haptics.impactAsync as jest.Mock).mockClear()
    await rate(4)
    expect(screen.queryByText(/Rating sent/)).toBeNull()
    expect(screen.getByText(/If you have pain or burning/)).toBeTruthy()
    expect(Haptics.impactAsync).not.toHaveBeenCalled()
  })
})
