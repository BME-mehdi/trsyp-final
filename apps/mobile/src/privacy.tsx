import { useEffect, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { colors } from '@symbiomed/ui-tokens'
import { useSettings } from './settings'
import { Txt } from './ui'

/** Covers the screen whenever the app is not in the foreground, so the app switcher snapshot shows no data. */
export function PrivacyOverlay() {
  const { t } = useSettings()
  const [hidden, setHidden] = useState(AppState.currentState !== 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setHidden(s !== 'active'))
    return () => sub.remove()
  }, [])
  if (!hidden) return null
  return (
    <View style={styles.cover} testID="privacy-overlay">
      <Txt size="title">{t('privacy.hidden')}</Txt>
    </View>
  )
}
const styles = StyleSheet.create({ cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', zIndex: 100 } })
