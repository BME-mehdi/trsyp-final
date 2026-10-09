import Ionicons from '@expo/vector-icons/Ionicons'
import { LIMITS, PROGRAM_WEEKS, weeklyRecap, type EngagementInput } from '@symbiomed/domain'
import { colors, deep, elevation, iconSize, radius, radiusLg, space, status, warm } from '@symbiomed/ui-tokens'
import { router } from 'expo-router'
import { View } from 'react-native'
import { useBrace } from '../brace/status'
import { useSettings } from '../settings'
import { Button, Card, Txt } from '../ui'
import { BigRing } from '../visuals'

// Today's cards (layout inspired by the team's Figma). Every number comes from session data or the plan.

const onDeep = { color: colors.onAccent }

/** Deep card: one big ring for today's sessions, the program week as six segments, and gentle streak text. */
export function HeroCard({ done, week, streakDays, daysActiveWeek, hasHistory }: { done: number; week: number | null; streakDays: number; daysActiveWeek: number | null; hasHistory: boolean }) {
  const { t } = useSettings()
  const total = LIMITS.sessionsPerDay
  return (
    <View style={{ backgroundColor: deep, borderRadius: radiusLg.xl, padding: space.xl, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xl, ...elevation.mid.rn }}>
      <View accessible accessibilityLabel={`${t('today.ringCenter', { done, total })} ${t('today.ringLabel')}`}>
        <BigRing value={done / total} fill={colors.onAccent} track="rgba(255,255,255,0.22)">
          <Txt size="display" bold style={onDeep}>{t('today.ringCenter', { done, total })}</Txt>
          <Txt size="small" style={[onDeep, { textAlign: 'center', paddingHorizontal: space.sm }]}>{t('today.ringLabel')}</Txt>
        </BigRing>
      </View>
      <View style={{ flex: 1, minWidth: 180, gap: space.md }}>
        <Txt size="large" bold style={onDeep}>{t('today.tagline')}</Txt>
        {week !== null && (
          <View style={{ gap: space.sm }} accessible accessibilityLabel={t('progress.week', { week })}>
            <Txt style={onDeep}>{t('progress.week', { week })}</Txt>
            <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: PROGRAM_WEEKS }, (_, i) => (
                <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < week ? colors.onAccent : 'rgba(255,255,255,0.22)' }} />
              ))}
            </View>
          </View>
        )}
        {(streakDays > 0 || hasHistory) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name="leaf" size={iconSize.sm} color={colors.onAccent} accessibilityElementsHidden importantForAccessibility="no" />
            <Txt style={[onDeep, { flexShrink: 1 }]}>{streakDays > 0 ? t('today.streak', { days: streakDays }) : t('today.welcomeBack')}</Txt>
          </View>
        )}
        {daysActiveWeek !== null && <Txt style={onDeep}>{t('today.daysActiveWeek', { days: daysActiveWeek })}</Txt>}
      </View>
    </View>
  )
}

export type Item = { key: string; title: string; detail: string | null; state: 'done' | 'next' | 'todo'; status: string }

/** Today's sessions as a short checklist with a written status on every row. */
export function SessionList({ items }: { items: Item[] }) {
  const { t } = useSettings()
  return (
    <Card>
      <Txt size="large" bold accessibilityRole="header">{t('today.rings')}</Txt>
      {items.map((i, n) => (
        <View key={i.key} accessible accessibilityLabel={`${i.title}: ${i.status}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderTopWidth: n === 0 ? 0 : 1, borderColor: colors.divider }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: i.state === 'done' ? warm.fill : colors.background, borderWidth: i.state === 'done' ? 0 : 2, borderColor: i.state === 'next' ? colors.accent : colors.divider }}>
            {i.state === 'done' && <Ionicons name="checkmark" size={iconSize.md} color={colors.onAccent} accessibilityElementsHidden importantForAccessibility="no" />}
          </View>
          <View style={{ flex: 1 }}>
            <Txt bold>{i.title}</Txt>
            {i.detail && <Txt size="small" muted>{i.detail}</Txt>}
          </View>
          <View style={{ borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, backgroundColor: i.state === 'done' ? status.positive.bg : i.state === 'next' ? status.info.bg : 'transparent' }}>
            <Txt size="small" bold style={{ color: i.state === 'done' ? status.positive.fg : i.state === 'next' ? status.info.fg : colors.textMuted }}>{i.status}</Txt>
          </View>
        </View>
      ))}
    </Card>
  )
}

/** The brace at a glance: link state, last recorded knee bend and last session time. */
export function BraceCard({ lastBend, lastSession }: { lastBend: number | null; lastSession: string | null }) {
  const { t } = useSettings()
  const brace = useBrace()
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Ionicons name="bluetooth" size={iconSize.md} color={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
        <Txt size="large" bold accessibilityRole="header">{t('today.braceTitle')}</Txt>
      </View>
      <Txt muted>{brace.link === 'connected' ? t('brace.connected') : t('brace.demo')}</Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: space.sm }}>
        <Txt>{t('today.braceLastBend')}</Txt>
        <Txt size="title" bold>{lastBend === null ? '–' : `${lastBend}°`}</Txt>
      </View>
      {lastSession && <Txt size="small" muted>{t('today.braceLastSession', { time: lastSession })}</Txt>}
      <Button variant="secondary" label={t('today.braceOpen')} onPress={() => router.push('/brace')} />
    </Card>
  )
}

/** The last 7 days in plain sentences, from session data only (template text, no language model). */
export function WeekCard({ input }: { input: EngagementInput }) {
  const { t } = useSettings()
  const r = weeklyRecap(input)
  const knee = r.kneeBendChangeDeg
  return (
    <Card tint={warm.surface}>
      <Txt size="large" bold accessibilityRole="header" style={{ color: warm.ink }}>{t('recap.weekTitle')}</Txt>
      <Txt>{t('recap.sentence', { sessions: r.sessions, days: r.daysActive })}</Txt>
      <Txt>{knee === null ? t('recap.noData') : t('recap.kneeSentence', { value: knee > 0 ? `+${knee}` : knee })}</Txt>
      {r.badgesEarned.length > 0 && <Txt>{t('recap.badgeSentence', { count: r.badgesEarned.length })}</Txt>}
      <Txt size="small" muted>{t('recap.fromData')}</Txt>
    </Card>
  )
}
