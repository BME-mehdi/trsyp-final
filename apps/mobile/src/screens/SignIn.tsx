import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { CONFIG, redirectUri, useAuth } from '../auth'
import { useSettings } from '../settings'
import { Button, Screen, Txt } from '../ui'

WebBrowser.maybeCompleteAuthSession()

/** Sign-in (Keycloak, code + PKCE in the system browser; or the mock BFF), and biometric unlock when locked. */
export function SignInScreen() {
  const { t } = useSettings()
  const { status, completeSignIn, unlock, signOut } = useAuth()
  const [error, setError] = useState(false)
  const discovery = AuthSession.useAutoDiscovery(CONFIG.issuer)
  const [request, , promptAsync] = AuthSession.useAuthRequest({ clientId: CONFIG.clientId, redirectUri: redirectUri(), scopes: ['openid'], usePKCE: true }, discovery)

  const signIn = async () => {
    setError(false)
    try {
      if (CONFIG.mock) {
        const r = (await (await fetch(`${CONFIG.bff}/api/dev/token?as=patient`)).json()) as { access_token: string }
        return await completeSignIn({ accessToken: r.access_token, expiresIn: 900 })
      }
      const res = await promptAsync()
      if (res.type !== 'success' || !discovery || !request) return setError(true)
      const tokens = await AuthSession.exchangeCodeAsync({ clientId: CONFIG.clientId, code: res.params.code!, redirectUri: redirectUri(), extraParams: { code_verifier: request.codeVerifier! } }, discovery)
      await completeSignIn({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn })
    } catch {
      setError(true)
    }
  }

  if (status === 'locked') {
    return (
      <Screen title={t('unlock.title')}>
        <Txt size="large">{t('unlock.locked')}</Txt>
        {error && <Txt accessibilityRole="alert">{t('unlock.failed')}</Txt>}
        <Button label={t('unlock.button')} onPress={() => void unlock().then((ok) => setError(!ok))} testID="unlock" />
        <Button variant="secondary" label={t('unlock.signInAgain')} onPress={() => void signOut()} />
      </Screen>
    )
  }
  return (
    <Screen title={t('signIn.title')}>
      <Txt size="large">{t('signIn.intro')}</Txt>
      {error && <Txt accessibilityRole="alert">{t('signIn.failed')}</Txt>}
      <Button label={t('signIn.button')} onPress={() => void signIn()} disabled={status === 'loading'} testID="sign-in" />
    </Screen>
  )
}
