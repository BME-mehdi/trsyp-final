import Ionicons from '@expo/vector-icons/Ionicons'
import { badges, weeklyRecap, type EngagementInput, type TodayRings } from '@symbiomed/domain'
import { colors, iconSize, radius, space, status, touchTarget, warm } from '@symbiomed/ui-tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { REST_REASONS, addRestDay, needsGuidance, type RestReason } from '../rest'
import { useSettings } from '../settings'
import { Button, Card, Txt } from '../ui'
import { Ring } from '../visuals'

export function TodayRingsCard({ rings }: { rings: TodayRings }) {
  const { t } = useSettings()
  const st = (done: boolean) => t(done ? 'today.ring.done' : 'today.ring.notYet')
  return (
    <Card>
      <Txt bold>{t('today.rings')}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-around' }}>
        <Ring value={rings.sessionsDone >= 1 ? 1 : 0} label={t('today.ring.session1')} state={st(rings.sessionsDone >= 1)} />
        <Ring value={rings.sessionsDone >= 2 ? 1 : 0} label={t('today.ring.session2')} state={st(rings.sessionsDone >= 2)} />
        <Ring value={rings.rated ? 1 : 0} label={t('today.ring.rating')} state={st(rings.rated)} />
      </View>
    </Card>
  )
}

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

export function BadgeList({ input }: { input: EngagementInput }) {
  const { t } = useSettings()
  return (
    <Card>
      <Txt bold>{t('badges.title')}</Txt>
      {badges(input).map((b) => {
        const state = b.earned === null ? t('badge.notTracked') : b.earned ? t('badge.earned') : t('badge.progress', { count: Math.min(b.count ?? 0, b.target), target: b.target })
        return (
          <View key={b.id} accessible accessibilityLabel={`${t(`badge.${b.id}`)}: ${state}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md, backgroundColor: b.earned ? warm.badgeBg : 'transparent' }}>
            <Ionicons name={b.earned ? 'ribbon' : b.earned === null ? 'time-outline' : 'ribbon-outline'} size={iconSize.lg} color={b.earned ? warm.ink : colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
            <View style={{ flex: 1 }}>
              <Txt bold>{t(`badge.${b.id}`)}</Txt>
              <Txt size="small" muted={!b.earned} style={b.earned ? { color: warm.ink } : undefined}>{state}</Txt>
            </View>
          </View>
        )
      })}
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
