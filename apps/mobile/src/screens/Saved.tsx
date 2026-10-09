import { LIMITS, dayKey } from '@symbiomed/domain'
import type { SessionSummary } from '@symbiomed/domain'
import { warm } from '@symbiomed/ui-tokens'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { useMotion } from '../motion'
import { useSettings } from '../settings'
import { Button, Card, Screen, Txt } from '../ui'
import { Ring } from '../visuals'
import { Pop } from '../anim'

/**
 * After a rating is sent. Pain at or above the threshold: no celebration, the high-pain guidance only.
 * Otherwise a short completion moment: the rating ring fills, one light haptic, one sentence.
 * With reduce motion on, the ring is drawn filled and there is no haptic.
 */
export function SavedScreen({ pain, sessions }: { pain: number | null; sessions: readonly SessionSummary[] }) {
  const { t } = useSettings()
  const { reduce, tick } = useMotion()
  const high = pain !== null && pain >= LIMITS.ai.painThreshold
  // One tick when the moment shows (tick is stable in behaviour; not a dependency on purpose).
  useEffect(() => { if (!high && !reduce) tick() }, [high, reduce])
  const now = new Date()
  const off = -now.getTimezoneOffset()
  const done = Math.min(LIMITS.sessionsPerDay, sessions.filter((s) => dayKey(s.startedAt, off) === dayKey(now, off)).length)
  return (
    <Screen title={t('feedback.title')}>
      <Txt size="large" accessibilityRole="alert">{t('feedback.saved')}</Txt>
      {high ? (
        <Card><Txt accessibilityRole="alert">{t('feedback.highPain')}</Txt><Button variant="secondary" label={t('emergency.title')} onPress={() => router.push('/emergency')} /></Card>
      ) : (
        <Pop><Card tint={warm.surface}>
          <Ring value={1} size={96} label={t('today.ring.rating')} state={t('today.ring.done')} />
          <Txt bold style={{ color: warm.ink, textAlign: 'center' }}>{t('celebrate.rated', { done, total: LIMITS.sessionsPerDay })}</Txt>
        </Card></Pop>
      )}
      <Button label={t('common.continue')} onPress={() => router.replace('/')} />
    </Screen>
  )
}
