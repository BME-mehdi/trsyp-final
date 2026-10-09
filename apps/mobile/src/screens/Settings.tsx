import { LANGS } from '@symbiomed/i18n'
import { space } from '@symbiomed/ui-tokens'
import * as LocalAuthentication from 'expo-local-authentication'
import { useEffect, useState } from 'react'
import { Switch, View } from 'react-native'
import { useAuth } from '../auth'
import { LANG_NAMES, useSettings, type TextScale } from '../settings'
import { Button, Screen, Txt } from '../ui'

const SIZES: [TextScale, 'settings.textNormal' | 'settings.textLarge' | 'settings.textLarger'][] = [[1, 'settings.textNormal'], [1.25, 'settings.textLarge'], [1.5, 'settings.textLarger']]

export function SettingsScreen() {
  const { t, lang, textScale, biometric, set } = useSettings()
  const { signOut } = useAuth()
  const [canBio, setCanBio] = useState(false)
  useEffect(() => {
    void Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]).then(([h, e]) => setCanBio(h && e))
  }, [])
  return (
    <Screen title={t('settings.title')}>
      <Txt size="large" bold accessibilityRole="header">{t('language.title')}</Txt>
      <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
        {LANGS.map((l) => (
          <Button key={l} variant={l === lang ? 'primary' : 'secondary'} label={LANG_NAMES[l]} onPress={() => set({ lang: l })} testID={`lang-${l}`} />
        ))}
      </View>
      <Txt size="large" bold accessibilityRole="header">{t('settings.textSize')}</Txt>
      <View style={{ gap: space.sm }}>
        {SIZES.map(([scale, key]) => (
          <Button key={key} variant={scale === textScale ? 'primary' : 'secondary'} label={t(key)} onPress={() => set({ textScale: scale })} testID={`size-${scale}`} />
        ))}
      </View>
      {canBio && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: space.md }}>
          <Txt style={{ flex: 1 }}>{t('settings.biometric')}</Txt>
          <Switch value={biometric} onValueChange={(v) => set({ biometric: v })} accessibilityLabel={t('settings.biometric')} />
        </View>
      )}
      <Txt>{t('settings.signOutHelp')}</Txt>
      <Button variant="secondary" label={t('signIn.signOut')} onPress={() => void signOut()} testID="sign-out" />
    </Screen>
  )
}
