import type { MessageKey } from '@symbiomed/i18n'
import { useSettings } from '../settings'
import { Card, Screen, Txt } from '../ui'

const ITEMS: [MessageKey, MessageKey][] = [
  ['emergency.painTitle', 'emergency.pain'],
  ['emergency.calfTitle', 'emergency.calf'],
  ['emergency.chestTitle', 'emergency.chest'],
  ['emergency.deviceTitle', 'emergency.device'],
]

/** Works offline: every word comes from the bundled string tables (@symbiomed/i18n). No query, no fetch. */
export function EmergencyScreen() {
  const { t } = useSettings()
  return (
    <Screen title={t('emergency.title')}>
      <Card>
        <Txt size="title" bold>{t('emergency.stop')}</Txt>
        <Txt size="large">{t('emergency.appCannotStop')}</Txt>
      </Card>
      {ITEMS.map(([title, body]) => (
        <Card key={title}>
          <Txt size="title" bold accessibilityRole="header">{t(title)}</Txt>
          <Txt size="large">{t(body)}</Txt>
        </Card>
      ))}
      <Txt muted>{t('emergency.offline')}</Txt>
    </Screen>
  )
}
