import { act, render, screen } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { PrivacyOverlay } from '../src/privacy'
import { SettingsProvider } from '../src/settings'

describe('Privacy overlay', () => {
  it('covers the screen when the app leaves the foreground', async () => {
    let listener: (s: AppStateStatus) => void = () => undefined
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, l) => ((listener = l as typeof listener), { remove: () => undefined }))
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true })
    await render(<SettingsProvider initial={{ lang: 'en' }}><PrivacyOverlay /></SettingsProvider>)
    expect(screen.queryByTestId('privacy-overlay')).toBeNull()
    await act(() => listener('inactive'))
    expect(screen.getByText('Content hidden')).toBeTruthy()
    await act(() => listener('active'))
    expect(screen.queryByTestId('privacy-overlay')).toBeNull()
  })
})
