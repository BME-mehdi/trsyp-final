import { statusTone } from '@symbiomed/ui-tokens'
import { useBrace } from '../brace/status'
import { useSettings } from '../settings'
import { Button, Card, Chip, Screen, Txt } from '../ui'

const LABEL = { connected: 'brace.connected', disconnected: 'brace.disconnected', searching: 'brace.searching', syncing: 'sync.inProgress', error: 'sync.failed' } as const

export function BraceScreen({ children }: { children?: React.ReactNode }) {
  const { t, lang } = useSettings()
  const b = useBrace()
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <Screen title={t('brace.title')}>
      <Chip tone={statusTone.brace[b.link === 'searching' ? 'syncing' : b.link]} label={t(LABEL[b.link])} />
      <Card>
        <Txt size="large">{b.lastSyncAt ? t('sync.done', { time: fmt.format(new Date(b.lastSyncAt)) }) : t('brace.noSync')}</Txt>
        {b.planVersionOnBrace !== null && <Txt>{t('brace.planOnBrace', { version: b.planVersionOnBrace })}</Txt>}
        {b.pendingUploads > 0 && <Txt>{t('sync.pendingUpload', { count: b.pendingUploads })}</Txt>}
      </Card>
      {b.message && <Txt accessibilityRole="alert" testID="brace-message">{b.message}</Txt>}
      <Button label={t('brace.sync')} onPress={() => void b.sync()} disabled={b.link === 'searching' || b.link === 'syncing'} testID="sync" />
      {b.kind === 'mock' && <Txt muted>{t('brace.demo')}</Txt>}
      {children}
    </Screen>
  )
}
