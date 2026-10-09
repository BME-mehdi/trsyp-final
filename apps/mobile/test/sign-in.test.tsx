import * as LocalAuthentication from 'expo-local-authentication'
import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useAuth } from '../src/auth'
import { SignInScreen } from '../src/screens/SignIn'
import { renderScreen } from './render'

function Status() {
  return <Text testID="status">{useAuth().status}</Text>
}

describe('Sign-in and biometric unlock', () => {
  it('asks to sign in when there is no token', async () => {
    await renderScreen(<><SignInScreen /><Status /></>, { signedIn: false })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-out'))
    expect(screen.getByText('Sign in with the account your clinic gave you.')).toBeTruthy()
  })

  it('locks a stored session behind biometrics and unlocks it', async () => {
    await renderScreen(<><SignInScreen /><Status /></>, { settings: { biometric: true } })
    expect(await screen.findByText('The app is locked.')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('unlock'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-in'))
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled()
  })
})
