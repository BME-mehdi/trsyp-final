import { fireEvent, screen } from '@testing-library/react-native'
import { ChecklistScreen } from '../src/screens/Checklist'
import { fakeApi, renderScreen } from './render'

describe('Pre-session checklist', () => {
  it('enables "I am ready" only when every point is ticked, and it only changes the display', async () => {
    const api = fakeApi()
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    await renderScreen(<ChecklistScreen />, { api })
    const ready = screen.getByTestId('ready')
    expect(ready).toBeDisabled()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(4)
    for (const b of boxes.slice(0, 3)) await fireEvent.press(b)
    expect(screen.getByTestId('ready')).toBeDisabled()
    await fireEvent.press(boxes[3]!)
    expect(screen.getByTestId('ready')).toBeEnabled()
    await fireEvent.press(screen.getByTestId('ready'))
    expect(await screen.findByText('You are ready')).toBeTruthy()
    expect(screen.getByText(/The app does not start or stop stimulation/)).toBeTruthy()
    expect(api.calls).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
