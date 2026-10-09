import Ionicons from '@expo/vector-icons/Ionicons'
import { LIMITS, dayKey, journey, programWeek, streak, todayRings, type EngagementInput } from '@symbiomed/domain'
import { colors, iconSize, space } from '@symbiomed/ui-tokens'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useApi } from '../api'
import { useAuth } from '../auth'
import { hoursMinutes, nextAction, todayView } from '../logic'
import { useRestDays } from '../rest'
import { useSettings } from '../settings'
import { Button, Card, Chip, Screen, Txt } from '../ui'
import { FadeIn } from '../anim'
import { HeroCard, RecapCard, RestDayCard, StopChip, TodayRingsCard } from './TodayParts'

const Big = ({ label, value }: { label: string; value: string }) => (
  <View accessible accessibilityLabel={`${label}: ${value}`}>
    <Txt muted>{label}</Txt>
    <Txt size="display" bold>{value}</Txt>
  </View>
)

export function TodayScreen() {
  const { t, lang } = useSettings()
  const api = useApi()
  const { patientId } = useAuth()
  const plan = useQuery({ queryKey: ['plan'], queryFn: () => api.getPlan(patientId!), enabled: !!patientId })
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.getSessions(patientId!), enabled: !!patientId })
  const rest = useRestDays()
  const [now, setNow] = useState(() => new Date())
  const [planOpen, setPlanOpen] = useState(true)
  const [restOpen, setRestOpen] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000) // countdown, minute by minute
    return () => clearInterval(id)
  }, [])

  if (plan.isPending || sessions.isPending) return <Screen title={t('plan.title')}><Txt>{t('common.loading')}</Txt></Screen>
  if (plan.isError || sessions.isError) return <Screen title={t('plan.title')}><Txt accessibilityRole="alert">{t('common.error')}</Txt></Screen>
  const list = sessions.data.sessions
  const view = todayView(plan.data.plan, list, now)
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const offsetMin = -now.getTimezoneOffset()
  const input: EngagementInput = { sessions: list, restDays: rest.map((r) => r.day), now, offsetMin }
  const today = dayKey(now, offsetMin)
  const week = programWeek(input)

  if (view.kind !== 'active') {
    return (
      <Screen title={t('nav.today')}>
        <StopChip />
        <Chip tone={view.kind === 'expired' ? 'critical' : 'neutral'} label={t(view.kind === 'expired' ? 'plan.status.expired' : 'plan.status.none')} />
        <Card>
          <Txt size="large" accessibilityRole="alert">{t(view.kind === 'expired' ? 'plan.expiredHelp' : 'plan.noneHelp')}</Txt>
        </Card>
        <Button variant="secondary" label={t('emergency.title')} onPress={() => router.push('/emergency')} />
      </Screen>
    )
  }
  const p = view.plan
  const left = hoursMinutes(view.remainingMs)
  const action = nextAction(view, list)
  const s = streak(input)
  const thisWeek = journey(input).find((w) => w.state === 'current')
  const restedToday = rest.some((r) => r.day === today)
  return (
    <Screen title={t('nav.today')}>
      <FadeIn index={0}><HeroCard hour={now.getHours()} week={week} streakDays={s.days} daysActiveWeek={thisWeek?.daysActive ?? null} hasHistory={list.length > 0} /></FadeIn>
      <FadeIn index={1}><StopChip /></FadeIn>
      <FadeIn index={2}><TodayRingsCard rings={todayRings(input)} /></FadeIn>
      <FadeIn index={3}>
      {restedToday ? (
        <Card><Txt bold>{t('rest.saved')}</Txt><Txt>{t('rest.planUnchanged')}</Txt><Txt size="small" muted>{t('rest.demo')}</Txt></Card>
      ) : action.kind === 'allDone' ? (
        <Card><Txt size="large" bold accessibilityRole="header">{t('today.next.allDone')}</Txt><Txt>{t('today.next.allDoneHelp')}</Txt></Card>
      ) : action.kind === 'wait' ? (
        <Card><Txt size="large" bold>{t('today.next.wait', { time: fmt.format(action.from) })}</Txt></Card>
      ) : action.kind === 'rate' ? (
        <Button label={t('today.next.rate')} onPress={() => router.push('/after-session')} />
      ) : (
        <Button label={t('today.next.checklist', { n: action.n })} onPress={() => router.push('/checklist')} />
      )}
      </FadeIn>
      {now.getDay() === 1 && <FadeIn index={4}><RecapCard input={input} title="recap.monday" /></FadeIn>}
      <FadeIn index={5}>
      <Card>
        <Pressable onPress={() => setPlanOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: planOpen }} accessibilityLabel={t(planOpen ? 'today.planHide' : 'today.planShow')}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Txt size="large" bold style={{ flexShrink: 1 }}>{t('plan.title')}</Txt>
          <Ionicons name={planOpen ? 'chevron-up' : 'chevron-down'} size={iconSize.md} color={colors.text} accessibilityElementsHidden importantForAccessibility="no" />
        </Pressable>
        <Chip tone="positive" label={t('plan.status.approved')} />
        {planOpen && (
          <>
            <Txt>{t('plan.validFor', left)}</Txt>
            <Txt muted>{t('plan.validUntil', { datetime: fmt.format(new Date(p.expiresAt)) })}</Txt>
            <Big label={t('plan.contractions')} value={t('plan.contractionsValue', { count: p.contractions })} />
            <Big label={t('plan.onTime')} value={t('plan.onTimeValue', { seconds: LIMITS.rampUpS + LIMITS.holdS + LIMITS.rampDownS })} />
            <Big label={t('plan.restTime')} value={t('plan.restTimeValue', { seconds: p.offS })} />
            <Big label={t('plan.maxIntensity')} value={t('plan.maxIntensityValue', { value: p.ceilingMa })} />
            <Txt>{t('plan.sessionsToday', { done: view.sessionsToday, total: LIMITS.sessionsPerDay })}</Txt>
          </>
        )}
      </Card>
      </FadeIn>
      {!restedToday && (restOpen
        ? <RestDayCard today={today} onDone={() => setRestOpen(false)} />
        : <Button variant="secondary" label={t('today.restDay')} onPress={() => setRestOpen(true)} testID="rest-open" />)}
    </Screen>
  )
}
