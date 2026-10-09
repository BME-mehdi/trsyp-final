import { colors } from '@symbiomed/ui-tokens'
import { useQuery } from '@tanstack/react-query'
import Svg, { Line, Polyline } from 'react-native-svg'
import { useApi } from '../api'
import { useAuth } from '../auth'
import { progress } from '../logic'
import { useSettings } from '../settings'
import { Card, Screen, Txt } from '../ui'

/** Goal shown to the patient: 110° at week 6, to confirm (docs/OPEN_QUESTIONS.md item 16). */
export const FLEXION_GOAL_DEG = 110

/** Tiny line chart, decorative: the numbers are written out next to it. */
function Sparkline({ values, goal }: { values: number[]; goal: number }) {
  const w = 300, h = 80, max = Math.max(goal + 10, ...values), min = Math.min(40, ...values)
  const y = (v: number) => h - ((v - min) / (max - min)) * h
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${y(v)}`).join(' ')
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={0} x2={w} y1={y(goal)} y2={y(goal)} stroke={colors.textMuted} strokeDasharray="4 4" />
      <Polyline points={pts} fill="none" stroke={colors.accent} strokeWidth={3} />
    </Svg>
  )
}

export function ProgressScreen() {
  const { t } = useSettings()
  const api = useApi()
  const { patientId } = useAuth()
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.getSessions(patientId!), enabled: !!patientId })
  const plan = useQuery({ queryKey: ['plan'], queryFn: () => api.getPlan(patientId!), enabled: !!patientId })
  if (sessions.isPending || plan.isPending) return <Screen title={t('progress.title')}><Txt>{t('common.loading')}</Txt></Screen>
  if (sessions.isError || plan.isError) return <Screen title={t('progress.title')}><Txt accessibilityRole="alert">{t('common.error')}</Txt></Screen>
  if (sessions.data.sessions.length === 0) return <Screen title={t('progress.title')}><Txt>{t('progress.noData')}</Txt></Screen>
  const p = progress(sessions.data.sessions, plan.data.plan?.aTargetPctMvc ?? 30, new Date())
  return (
    <Screen title={t('progress.title')}>
      {p.week !== null && <Txt size="large">{t('progress.week', { week: p.week })}</Txt>}
      <Card>
        <Txt bold>{t('progress.flexion')}</Txt>
        <Txt size="display" bold>{t('progress.flexionValue', { value: Math.round(p.flexion.latest ?? 0), goal: FLEXION_GOAL_DEG })}</Txt>
        <Sparkline values={p.flexion.series} goal={FLEXION_GOAL_DEG} />
      </Card>
      <Card>
        <Txt bold>{t('progress.engagement')}</Txt>
        <Txt size="display" bold>{p.engagementPct === null ? '–' : t('progress.engagementValue', { value: p.engagementPct })}</Txt>
        <Txt>{t('progress.engagementHelp')}</Txt>
      </Card>
      <Card>
        <Txt bold>{t('progress.adherence')}</Txt>
        <Txt size="display" bold>{t('progress.adherenceValue', { done: p.adherence.done, planned: p.adherence.planned })}</Txt>
        <Txt>{t('progress.adherenceHelp')}</Txt>
      </Card>
    </Screen>
  )
}
