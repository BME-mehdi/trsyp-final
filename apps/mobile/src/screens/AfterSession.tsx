import Slider from '@react-native-community/slider'
import { LIMITS } from '@symbiomed/domain'
import { colors, space } from '@symbiomed/ui-tokens'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useApi } from '../api'
import { useAuth } from '../auth'
import { outcomeOk, sessionToRate } from '../logic'
import { useSettings } from '../settings'
import { Button, Card, Screen, Txt } from '../ui'

const COMFORT = ['comfort.0', 'comfort.1', 'comfort.2', 'comfort.3'] as const

export function AfterSessionScreen() {
  const { t, textScale } = useSettings()
  const api = useApi()
  const { patientId } = useAuth()
  const qc = useQueryClient()
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.getSessions(patientId!), enabled: !!patientId })
  const [comfort, setComfort] = useState<number | null>(null)
  const [pain, setPain] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const send = useMutation({
    mutationFn: (sessionId: string) => api.postOutcome(patientId!, { sessionId, comfort: comfort!, pain: pain!, note: note.trim() || null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  if (sessions.isPending) return <Screen title={t('feedback.title')}><Txt>{t('common.loading')}</Txt></Screen>
  const target = sessions.data ? sessionToRate(sessions.data.sessions) : null
  if (send.isSuccess) return <Screen title={t('feedback.title')}><Txt size="large" accessibilityRole="alert">{t('feedback.saved')}</Txt></Screen>
  if (!target) return <Screen title={t('feedback.title')}><Txt size="large">{t('feedback.noSession')}</Txt></Screen>

  const valid = outcomeOk({ sessionId: target.sessionId, comfort, pain, note })
  const setPainSafe = (v: number) => setPain(Math.max(LIMITS.pain.min, Math.min(LIMITS.pain.max, Math.round(v))))
  return (
    <Screen title={t('feedback.title')}>
      <Txt size="large" bold>{t('feedback.comfortQuestion')}</Txt>
      <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
        {COMFORT.map((k, i) => (
          <Pressable key={k} onPress={() => setComfort(i)} accessibilityRole="radio" accessibilityState={{ checked: comfort === i }} accessibilityLabel={t(k)}
            style={[styles.choice, comfort === i && styles.choiceOn]} testID={`comfort-${i}`}>
            <Txt size="large" bold={comfort === i} style={comfort === i ? { color: colors.onAccent } : undefined}>{t(k)}</Txt>
          </Pressable>
        ))}
      </View>

      <Txt size="large" bold>{t('feedback.painQuestion')}</Txt>
      <Txt size="display" bold accessibilityLiveRegion="polite" testID="pain-readout">{pain === null ? '–' : t('feedback.painValue', { value: pain })}</Txt>
      <Slider minimumValue={LIMITS.pain.min} maximumValue={LIMITS.pain.max} step={1} value={pain ?? 0} onValueChange={setPainSafe}
        accessibilityLabel={t('feedback.painQuestion')} minimumTrackTintColor={colors.accent} thumbTintColor={colors.accent} style={{ height: 48 }} testID="pain-slider" />
      <View style={styles.row}>
        <View style={{ flex: 1 }}><Button variant="secondary" label={t('feedback.lower')} onPress={() => setPainSafe((pain ?? 0) - 1)} /></View>
        <View style={{ flex: 1 }}><Button variant="secondary" label={t('feedback.higher')} onPress={() => setPainSafe((pain ?? -1) + 1)} /></View>
      </View>
      <View style={styles.row}><Txt muted>{t('pain.min')}</Txt><Txt muted>{t('pain.max')}</Txt></View>
      {pain !== null && pain >= LIMITS.ai.painThreshold && <Card><Txt accessibilityRole="alert">{t('feedback.highPain')}</Txt></Card>}

      <Txt size="large" bold>{t('feedback.note')}</Txt>
      <Txt>{t('feedback.noteWarning')}</Txt>
      <TextInput value={note} onChangeText={(v) => setNote(v.slice(0, 200))} maxLength={200} multiline accessibilityLabel={t('feedback.note')}
        accessibilityHint={t('feedback.noteWarning')} style={[styles.input, { fontSize: 17 * textScale }]} testID="note" />
      <Txt muted>{t('feedback.noteCount', { count: note.length })}</Txt>

      {comfort === null && <Txt>{t('feedback.chooseComfort')}</Txt>}
      {send.isError && <Txt accessibilityRole="alert">{t('feedback.notSent')}</Txt>}
      <Button label={t('feedback.submit')} disabled={!valid || send.isPending} onPress={() => send.mutate(target.sessionId)} testID="submit" />
    </Screen>
  )
}
const styles = StyleSheet.create({
  choice: { minHeight: 56, borderWidth: 2, borderColor: colors.control, borderRadius: 8, padding: space.md, justifyContent: 'center' },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap' },
  input: { minHeight: 96, borderWidth: 2, borderColor: colors.control, borderRadius: 8, padding: space.md, color: colors.text, textAlignVertical: 'top' },
})
