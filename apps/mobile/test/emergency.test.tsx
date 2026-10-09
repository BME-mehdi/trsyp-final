import { messages } from '@symbiomed/i18n'
import { screen } from '@testing-library/react-native'
import { EmergencyScreen } from '../src/screens/Emergency'
import { renderScreen } from './render'

describe('Emergency (offline)', () => {
  it('renders every instruction from the bundled strings with the network off', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'))
    await renderScreen(<EmergencyScreen />, { signedIn: false })
    for (const k of ['emergency.stop', 'emergency.painTitle', 'emergency.pain', 'emergency.calfTitle', 'emergency.calf', 'emergency.chestTitle', 'emergency.chest', 'emergency.deviceTitle', 'emergency.device'] as const) {
      expect(screen.getByText(messages.en[k])).toBeTruthy()
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('works in French too', async () => {
    await renderScreen(<EmergencyScreen />, { settings: { lang: 'fr' }, signedIn: false })
    expect(screen.getByText(messages.fr['emergency.calf'])).toBeTruthy()
  })
})
