import type { MessageKey } from '@symbiomed/i18n'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { colors, elevation, iconSize, radiusLg, space, warm } from '@symbiomed/ui-tokens'
import { FadeIn, Pop } from '../anim'
import { Bar } from '../visuals'
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
        <Pop><Card tint={warm.surface}>
          <View style={{ alignItems: 'center' }}><Ionicons name="checkmark-circle" size={iconSize.xl * 2} color={warm.fill} accessibilityElementsHidden importantForAccessibility="no" /></View>
          <Txt size="large" accessibilityRole="alert">{t('checklist.readyHelp')}</Txt>
        </Card></Pop>
        <Txt>{t('emergency.stop')}</Txt>
      </Screen>
    )
  }
  return (
    <Screen title={t('checklist.title')}>
      <Txt>{t('checklist.intro')}</Txt>
      <Bar value={ticked.size / CHECKS.length} label={t('badge.progress', { count: ticked.size, target: CHECKS.length })} />
      {CHECKS.map((k, i) => (
        <FadeIn key={k} index={i}>
        <Pressable onPress={() => toggle(k)} accessibilityRole="checkbox" accessibilityState={{ checked: ticked.has(k) }} accessibilityLabel={t(k)} style={[styles.row, ticked.has(k) && styles.rowOn]}>
          <View style={[styles.box, ticked.has(k) && styles.boxOn]}><Pop show={ticked.has(k)}><Ionicons name="checkmark" size={iconSize.md} color={colors.onAccent} accessibilityElementsHidden importantForAccessibility="no" /></Pop></View>
          <View style={{ flex: 1 }}>
            <Txt size="large">{t(k)}</Txt>
            {k === 'checklist.contraindications' && CONTRA.map((c) => <Txt key={c}>• {t(c)}</Txt>)}
          </View>
        </Pressable>
        </FadeIn>
      ))}
      <Txt muted>{t('checklist.blocked')}</Txt>
      {!all && <Txt accessibilityLiveRegion="polite">{t('checklist.notReady')}</Txt>}
      <Button label={t('checklist.readyButton')} disabled={!all} onPress={() => setReady(true)} testID="ready" />
    </Screen>
  )
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, minHeight: 56, alignItems: 'flex-start', padding: space.lg, borderRadius: radiusLg.lg, backgroundColor: colors.background, borderWidth: 2, borderColor: 'transparent', ...elevation.low.rn },
  rowOn: { borderColor: colors.accent },
  box: { width: 32, height: 32, borderWidth: 2, borderColor: colors.control, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
})
