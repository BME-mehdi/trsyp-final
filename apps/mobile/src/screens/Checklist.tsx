import type { MessageKey } from '@symbiomed/i18n'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { colors, space } from '@symbiomed/ui-tokens'
import { useSettings } from '../settings'
import { Button, Card, Screen, Txt } from '../ui'

const CONTRA: MessageKey[] = ['contra.pacemaker', 'contra.dvt', 'contra.skin', 'contra.circulation', 'contra.malignancy', 'contra.epilepsy', 'contra.stopButton', 'contra.clearance']
export const CHECKS: MessageKey[] = ['checklist.contraindications', 'checklist.seated', 'checklist.charger', 'checklist.skin']

/**
 * Pre-session checklist. Ticking every point only changes what the app shows ("I'm ready"):
 * it never sends anything to the brace and never starts stimulation.
 */
export function ChecklistScreen() {
  const { t } = useSettings()
  const [ticked, setTicked] = useState<Set<MessageKey>>(new Set())
  const [ready, setReady] = useState(false)
  const all = CHECKS.every((k) => ticked.has(k))
  const toggle = (k: MessageKey) => {
    setReady(false)
    setTicked((cur) => {
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }
  if (ready) {
    return (
      <Screen title={t('checklist.ready')}>
        <Card><Txt size="large" accessibilityRole="alert">{t('checklist.readyHelp')}</Txt></Card>
        <Txt>{t('emergency.stop')}</Txt>
      </Screen>
    )
  }
  return (
    <Screen title={t('checklist.title')}>
      <Txt>{t('checklist.intro')}</Txt>
      {CHECKS.map((k) => (
        <Pressable key={k} onPress={() => toggle(k)} accessibilityRole="checkbox" accessibilityState={{ checked: ticked.has(k) }} accessibilityLabel={t(k)} style={styles.row}>
          <View style={[styles.box, ticked.has(k) && styles.boxOn]}>{ticked.has(k) && <Txt bold style={{ color: colors.onAccent }}>✓</Txt>}</View>
          <View style={{ flex: 1 }}>
            <Txt size="large">{t(k)}</Txt>
            {k === 'checklist.contraindications' && CONTRA.map((c) => <Txt key={c}>• {t(c)}</Txt>)}
          </View>
        </Pressable>
      ))}
      <Txt muted>{t('checklist.blocked')}</Txt>
      {!all && <Txt accessibilityLiveRegion="polite">{t('checklist.notReady')}</Txt>}
      <Button label={t('checklist.readyButton')} disabled={!all} onPress={() => setReady(true)} testID="ready" />
    </Screen>
  )
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, minHeight: 48, alignItems: 'flex-start', paddingVertical: space.sm },
  box: { width: 32, height: 32, borderWidth: 2, borderColor: colors.control, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
})
