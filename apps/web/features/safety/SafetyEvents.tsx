'use client'
import { safetyEvents } from '@symbiomed/domain'
import { useQuery } from '@tanstack/react-query'
import { Query } from '../../components/Query'
import { SafetyChip } from '../../components/StatusChip'
import { Table } from '../../components/Table'
import { useApi } from '../../lib/client'
import { formatDateTime } from '../../lib/format'

const CAUSE: Record<string, string> = {
  'stop-button': 'STOP button', usb: 'USB connected', battery: 'Low battery', watchdog: 'Watchdog', 'sensor-fault': 'Sensor fault',
  'lead-off': 'Electrode lead-off', 'current-error': 'Current tracking error', 'over-current': 'Over-current',
}

export function SafetyEvents({ patientId }: { patientId: string }) {
  const { api } = useApi()
  const q = useQuery({ queryKey: ['sessions', patientId], queryFn: () => api.getSessions(patientId) })
  return (
    <section aria-labelledby="safety">
      <h1 id="safety" className="text-2xl font-semibold">Safety events</h1>
      <p className="mt-1 text-muted">STOP presses, brace stops, pain of 4/10 or more and fixed-dose fallbacks, newest first.</p>
      <Query q={q}>
        {({ sessions }) => (
          <Table caption="Safety events" empty="No safety events."
            head={['When', 'Event', 'Cause', 'Pain']}
            rows={safetyEvents(sessions).reverse().map((e) => [
              formatDateTime(e.at), <SafetyChip key="k" kind={e.kind} />, e.cause ? CAUSE[e.cause] : '—', e.pain === null ? '—' : `${e.pain}/10`,
            ])} />
        )}
      </Query>
    </section>
  )
}
