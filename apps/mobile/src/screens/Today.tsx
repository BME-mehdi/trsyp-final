import { LIMITS } from '@symbiomed/domain'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useApi } from '../api'
import { useAuth } from '../auth'
import { hoursMinutes, todayView } from '../logic'
import { useSettings } from '../settings'
import { Button, Card, Chip, Screen, Txt } from '../ui'

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
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000) // countdown, minute by minute
    return () => clearInterval(id)
  }, [])

  if (plan.isPending || sessions.isPending) return <Screen title={t('plan.title')}><Txt>{t('common.loading')}</Txt></Screen>
  if (plan.isError || sessions.isError) return <Screen title={t('plan.title')}><Txt accessibilityRole="alert">{t('common.error')}</Txt></Screen>
  const view = todayView(plan.data.plan, sessions.data.sessions, now)
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (view.kind !== 'active') {
    return (
      <Screen title={t('plan.title')}>
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
  return (
    <Screen title={t('plan.title')}>
      <Chip tone="positive" label={t('plan.status.approved')} />
      <Txt>{t('plan.validFor', left)}</Txt>
      <Txt muted>{t('plan.validUntil', { datetime: fmt.format(new Date(p.expiresAt)) })}</Txt>
      <Card>
        <Big label={t('plan.contractions')} value={t('plan.contractionsValue', { count: p.contractions })} />
        <Big label={t('plan.onTime')} value={t('plan.onTimeValue', { seconds: LIMITS.rampUpS + LIMITS.holdS + LIMITS.rampDownS })} />
        <Big label={t('plan.restTime')} value={t('plan.restTimeValue', { seconds: p.offS })} />
        <Big label={t('plan.maxIntensity')} value={t('plan.maxIntensityValue', { value: p.ceilingMa })} />
      </Card>
      <Txt size="large">{t('plan.sessionsToday', { done: view.sessionsToday, total: LIMITS.sessionsPerDay })}</Txt>
      {view.sessionsToday >= LIMITS.sessionsPerDay && <Txt>{t('plan.limitReached')}</Txt>}
      {view.nextFrom && <Txt>{t('plan.nextSessionFrom', { time: fmt.format(view.nextFrom) })}</Txt>}
      <Button label={t('plan.startChecklist')} onPress={() => router.push('/checklist')} />
      <Button variant="secondary" label={t('plan.rateSession')} onPress={() => router.push('/after-session')} />
    </Screen>
  )
}
