import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { SettingsScreen } from '../src/screens/Settings'
import { useSettings } from '../src/settings'
import { Txt } from '../src/ui'
import { renderScreen, secureStore } from './render'

function Sample() {
  const { t } = useSettings()
  return <Txt testID="sample">{t('plan.title')}</Txt>
}

describe('Settings', () => {
  it('switches language and text size', async () => {
    await renderScreen(<><SettingsScreen /><Sample /></>)
    await fireEvent.press(screen.getByTestId('lang-fr'))
    expect(screen.getByTestId('sample')).toHaveTextContent('Programme du jour')
    await fireEvent.press(screen.getByTestId('size-1.5'))
    expect(screen.getByTestId('sample')).toHaveStyle({ fontSize: 17 * 1.5 })
    await waitFor(() => expect(JSON.parse(secureStore.get('symbiomed.settings')!)).toMatchObject({ lang: 'fr', textScale: 1.5 }))
  })

  it('sign-out wipes every stored key', async () => {
    const onSignedOut = jest.fn()
    await renderScreen(<SettingsScreen />, { onSignedOut })
    secureStore.set('symbiomed.refresh', 'r')
    secureStore.set('symbiomed.settings', '{}')
    await fireEvent.press(screen.getByTestId('sign-out'))
    await waitFor(() => expect(onSignedOut).toHaveBeenCalled())
    expect([...secureStore.keys()]).toEqual([])
  })
})
