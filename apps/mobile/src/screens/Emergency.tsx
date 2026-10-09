import Ionicons from '@expo/vector-icons/Ionicons'
import type { MessageKey } from '@symbiomed/i18n'
import { colors, iconSize, radius, space, status } from '@symbiomed/ui-tokens'
import type { ComponentProps } from 'react'
import { View } from 'react-native'
import { FadeIn } from '../anim'
import { useSettings } from '../settings'
import { Card, Screen, Txt } from '../ui'

type IconName = ComponentProps<typeof Ionicons>['name']
const ITEMS: [MessageKey, MessageKey, IconName][] = [
  ['emergency.painTitle', 'emergency.pain', 'flash'],
  ['emergency.calfTitle', 'emergency.calf', 'footsteps'],
  ['emergency.chestTitle', 'emergency.chest', 'heart'],
  ['emergency.deviceTitle', 'emergency.device', 'flame'],
]

/** Works offline: every word comes from the bundled string tables (@symbiomed/i18n). No query, no fetch. Icons only repeat the titles. */
export function EmergencyScreen() {
  const { t } = useSettings()
  return (
    <Screen title={t('emergency.title')}>
      <FadeIn>
        <View style={{ backgroundColor: status.critical.bg, borderRadius: 16, padding: space.lg, gap: space.sm, borderLeftWidth: 6, borderLeftColor: status.critical.fg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: status.critical.fg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="hand-left" size={iconSize.lg} color={colors.onAccent} accessibilityElementsHidden importantForAccessibility="no" />
            </View>
            <Txt size="title" bold style={{ flex: 1, color: status.critical.fg }}>{t('emergency.stop')}</Txt>
          </View>
          <Txt size="large">{t('emergency.appCannotStop')}</Txt>
        </View>
      </FadeIn>
      {ITEMS.map(([title, body, icon], i) => (
        <FadeIn key={title} index={i + 1}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={icon} size={iconSize.md} color={colors.text} accessibilityElementsHidden importantForAccessibility="no" />
              </View>
              <Txt size="title" bold accessibilityRole="header" style={{ flex: 1 }}>{t(title)}</Txt>
            </View>
            <Txt size="large">{t(body)}</Txt>
          </Card>
        </FadeIn>
      ))}
      <Txt muted>{t('emergency.offline')}</Txt>
    </Screen>
  )
}
