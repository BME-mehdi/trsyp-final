import Ionicons from '@expo/vector-icons/Ionicons'
import { badges, weeklyRecap, type BadgeId, type EngagementInput } from '@symbiomed/domain'
import { colors, iconSize, radius, radiusLg, space, status, touchTarget, warm } from '@symbiomed/ui-tokens'
import { router } from 'expo-router'
import { useState, type ComponentProps } from 'react'
import { Pressable, View } from 'react-native'
import { FadeIn } from '../anim'
import { REST_REASONS, addRestDay, needsGuidance, type RestReason } from '../rest'
import { useSettings } from '../settings'
import { Button, Card, Txt } from '../ui'

/** Persistent STOP guidance. The app cannot stop the brace; this only opens the guidance screen. */
export function StopChip() {
  const { t } = useSettings()
  return (
    <Pressable onPress={() => router.push('/emergency')} accessibilityRole="link" accessibilityLabel={t('today.stopChip')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: status.critical.bg, alignSelf: 'flex-start' }}>
      <Ionicons name="hand-left" size={iconSize.sm} color={status.critical.fg} accessibilityElementsHidden importantForAccessibility="no" />
      <Txt size="small" bold style={{ color: status.critical.fg, flexShrink: 1 }}>{t('today.stopChip')}</Txt>
    </Pressable>
  )
}

/** Monday card: last 7 days from session data. Template text only (no LLM on the patient side). */
export function RecapCard({ input, title }: { input: EngagementInput; title: 'recap.monday' | 'recap.title' }) {
  const { t } = useSettings()
  const r = weeklyRecap(input)
  const knee = r.kneeBendChangeDeg
  return (
    <Card tint={warm.surface}>
      <Txt bold style={{ color: warm.ink }}>{t(title)}</Txt>
      <Txt>{t('recap.sessions', { count: r.sessions })}</Txt>
      <Txt>{t('recap.daysActive', { count: r.daysActive })}</Txt>
      <Txt>{t('recap.badges', { count: r.badgesEarned.length })}</Txt>
      <Txt>{knee === null ? t('recap.noData') : t('recap.knee', { value: knee > 0 ? `+${knee}` : knee })}</Txt>
    </Card>
  )
}

type IconName = ComponentProps<typeof Ionicons>['name']
const BADGE_ICON: Record<BadgeId, [earned: IconName, locked: IconName]> = {
  'first-session': ['play-circle', 'play-circle-outline'],
  'first-full-day': ['sunny', 'sunny-outline'],
  'seven-days-active': ['calendar', 'calendar-outline'],
  'ten-ratings': ['chatbubble-ellipses', 'chatbubble-ellipses-outline'],
  'ten-checklists': ['checkbox', 'checkbox-outline'],
  'full-week': ['trophy', 'trophy-outline'],
}

/** Badge medallions, two per row. Earned ones are filled; locked ones show progress as text and a thin bar. */
export function BadgeList({ input }: { input: EngagementInput }) {
  const { t } = useSettings()
  const list = badges(input)
  const earnedCount = list.filter((b) => b.earned).length
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
        <Txt bold accessibilityRole="header">{t('badges.title')}</Txt>
        <Txt size="small" bold style={{ color: warm.ink }}>{t('badge.progress', { count: earnedCount, target: list.length })}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {list.map((b, i) => {
          const state = b.earned === null ? t('badge.notTracked') : b.earned ? t('badge.earned') : t('badge.progress', { count: Math.min(b.count ?? 0, b.target), target: b.target })
          const [on, off] = BADGE_ICON[b.id]
          const pct = b.count === null ? 0 : Math.min(100, (100 * b.count) / b.target)
          return (
            <FadeIn key={b.id} index={i} style={{ flexGrow: 1, flexBasis: '45%', minWidth: 140 }}>
              <View accessible accessibilityLabel={`${t(`badge.${b.id}`)}: ${state}`}
                style={{ alignItems: 'center', gap: space.xs, padding: space.md, borderRadius: radiusLg.lg, backgroundColor: b.earned ? warm.badgeBg : colors.surface }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: b.earned ? warm.fill : colors.background, borderWidth: b.earned ? 0 : 2, borderColor: colors.divider }}>
                  <Ionicons name={b.earned ? on : off} size={iconSize.lg} color={b.earned ? colors.onAccent : colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
                </View>
                <Txt bold style={{ textAlign: 'center' }}>{t(`badge.${b.id}`)}</Txt>
                <Txt size="small" style={{ textAlign: 'center', color: b.earned ? warm.ink : colors.textMuted }}>{state}</Txt>
                {b.earned === false && (
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: warm.track, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: warm.fill }} />
                  </View>
                )}
              </View>
            </FadeIn>
          )
        })}
      </View>
    </Card>
  )
}

/** "I am too tired today": UI only (demo), never changes the plan. Pain or swelling shows the guidance first. */
export function RestDayCard({ today, onDone }: { today: string; onDone: () => void }) {
  const { t } = useSettings()
  const [reason, setReason] = useState<RestReason | null>(null)
  return (
    <Card tint={warm.surface}>
      <Txt bold accessibilityRole="header">{t('rest.question')}</Txt>
      <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
        {REST_REASONS.map((r) => (
          <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ checked: reason === r }} testID={`rest-${r}`}
            style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 2, borderColor: reason === r ? colors.accent : colors.control, backgroundColor: colors.background }}>
            <Ionicons name={reason === r ? 'radio-button-on' : 'radio-button-off'} size={iconSize.md} color={reason === r ? colors.accent : colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
            <Txt>{t(`rest.${r}`)}</Txt>
          </Pressable>
        ))}
      </View>
      {reason && needsGuidance(reason) && (
        <View accessibilityRole="alert" style={{ gap: space.xs }}>
          <Txt bold>{t(reason === 'pain' ? 'emergency.painTitle' : 'emergency.calfTitle')}</Txt>
          <Txt>{t(reason === 'pain' ? 'emergency.pain' : 'emergency.calf')}</Txt>
          <Button variant="secondary" label={t('emergency.title')} onPress={() => router.push('/emergency')} />
        </View>
      )}
      <Button label={t('rest.confirm')} disabled={!reason} testID="rest-confirm" onPress={() => { if (reason) { addRestDay({ day: today, reason }); onDone() } }} />
      <Txt size="small" muted>{t('rest.demo')}</Txt>
    </Card>
  )
}
