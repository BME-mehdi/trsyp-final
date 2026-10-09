import Ionicons from '@expo/vector-icons/Ionicons'
import { journey, type EngagementInput, type JourneyWeek } from '@symbiomed/domain'
import { colors, iconSize, radius, space, warm } from '@symbiomed/ui-tokens'
import { useQuery } from '@tanstack/react-query'
import { View } from 'react-native'
import { useApi } from '../api'
import { useAuth } from '../auth'
import { progress } from '../logic'
import { useRestDays } from '../rest'
import { useSettings } from '../settings'
import { Card, Screen, Txt } from '../ui'
import { ArcGauge, Bar } from '../visuals'
import { BadgeList, RecapCard } from './TodayParts'
import { FadeIn } from '../anim'

/** Goal shown to the patient: 110° at week 6, to confirm (docs/OPEN_QUESTIONS.md item 16). */
export const FLEXION_GOAL_DEG = 110

/** One week-station. Text carries the state; the icon and fill only repeat it. */
function Station({ w, last }: { w: JourneyWeek; last: boolean }) {
  const { t } = useSettings()
  const title = w.state === 'done' ? t('journey.complete', { week: w.week }) : w.state === 'current' ? t('journey.current', { week: w.week }) : t('journey.upcoming', { week: w.week })
  const detail = w.sessions === null ? null : w.state === 'current' ? t('journey.sessionsSoFar', { done: w.sessions }) : t('journey.sessions', { done: w.sessions, planned: w.planned })
  const icon = w.state === 'done' ? 'checkmark-circle' : w.state === 'current' ? 'ellipse' : 'lock-closed-outline'
  return (
    <View style={{ flexDirection: 'row', gap: space.md }} accessible accessibilityLabel={detail ? `${title}. ${detail}` : title}>
      <View style={{ alignItems: 'center', width: iconSize.lg }}>
        <Ionicons name={icon} size={iconSize.lg} color={w.state === 'upcoming' ? colors.textMuted : warm.fill} accessibilityElementsHidden importantForAccessibility="no" />
        {!last && <View style={{ width: 3, flex: 1, minHeight: space.lg, backgroundColor: w.state === 'done' ? warm.fill : warm.track }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: space.md, gap: space.xs, ...(w.state === 'current' ? { backgroundColor: warm.surface, borderRadius: radius.md, padding: space.sm } : null) }}>
        <Txt bold={w.state !== 'upcoming'} muted={w.state === 'upcoming'}>{title}</Txt>
        {detail && <Txt size="small" muted>{detail}</Txt>}
      </View>
    </View>
  )
}

export function ProgressScreen() {
  const { t } = useSettings()
  const api = useApi()
  const { patientId } = useAuth()
  const rest = useRestDays()
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.getSessions(patientId!), enabled: !!patientId })
  const plan = useQuery({ queryKey: ['plan'], queryFn: () => api.getPlan(patientId!), enabled: !!patientId })
  if (sessions.isPending || plan.isPending) return <Screen title={t('progress.title')}><Txt>{t('common.loading')}</Txt></Screen>
  if (sessions.isError || plan.isError) return <Screen title={t('progress.title')}><Txt accessibilityRole="alert">{t('common.error')}</Txt></Screen>
  if (sessions.data.sessions.length === 0) return <Screen title={t('progress.title')}><Txt>{t('progress.noData')}</Txt></Screen>
  const now = new Date()
  const p = progress(sessions.data.sessions, plan.data.plan?.aTargetPctMvc ?? 30, now)
  const input: EngagementInput = { sessions: sessions.data.sessions, restDays: rest.map((r) => r.day), now, offsetMin: -now.getTimezoneOffset() }
  const weeks = journey(input)
  const latest = p.flexion.latest === null ? null : Math.round(p.flexion.latest)
  return (
    <Screen title={t('progress.title')} subtitle={p.week !== null ? t('progress.week', { week: p.week }) : undefined}>
      <FadeIn><Card>
        <Txt bold>{t('progress.flexion')}</Txt>
        {latest === null ? <Txt>{t('progress.noData')}</Txt> : (
          <>
            <ArcGauge value={latest} goal={FLEXION_GOAL_DEG} max={Math.max(140, latest)} />
            <Txt size="display" bold style={{ textAlign: 'center' }}>{t('progress.flexionValue', { value: latest, goal: FLEXION_GOAL_DEG })}</Txt>
            <Txt size="small" muted style={{ textAlign: 'center' }}>{t('progress.goalToConfirm')}</Txt>
          </>
        )}
      </Card></FadeIn>
      <FadeIn><Card>
        <Txt bold accessibilityRole="header">{t('journey.title')}</Txt>
        {weeks.map((w, i) => <Station key={w.week} w={w} last={i === weeks.length - 1} />)}
      </Card></FadeIn>
      <FadeIn><Card>
        <Txt bold>{t('progress.adherence')}</Txt>
        <Txt size="large" bold>{t('progress.adherenceValue', { done: p.adherence.done, planned: p.adherence.planned })}</Txt>
        <Txt>{t('progress.adherenceHelp')}</Txt>
        <Txt bold>{t('progress.weekly')}</Txt>
        {weeks.filter((w) => w.sessions !== null).map((w) => (
          <Bar key={w.week} value={(w.sessions ?? 0) / w.planned} label={t('progress.weekBar', { week: w.week, done: w.sessions ?? 0, planned: w.planned })} />
        ))}
      </Card></FadeIn>
      <RecapCard input={input} title="recap.title" />
      <BadgeList input={input} />
      <FadeIn><Card>
        <Txt bold>{t('progress.engagement')}</Txt>
        <Txt size="display" bold>{p.engagementPct === null ? '–' : t('progress.engagementValue', { value: p.engagementPct })}</Txt>
        <Txt>{t('progress.engagementHelp')}</Txt>
      </Card></FadeIn>
      <FadeIn><Card>
        <Txt bold>{t('soon.title')}</Txt>
        <Txt size="small" muted>{t('soon.note')}</Txt>
        {(['soon.exercises', 'soon.tens', 'soon.guide'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name="time-outline" size={iconSize.sm} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
            <Txt muted style={{ flexShrink: 1 }}>{t(k)}</Txt>
          </View>
        ))}
      </Card></FadeIn>
    </Screen>
  )
}
