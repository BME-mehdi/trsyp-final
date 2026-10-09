'use client'
import { safetyEvents } from '@symbiomed/domain'
import { useQuery } from '@tanstack/react-query'
import { Query } from '../../components/Query'
import { SafetyChip } from '../../components/StatusChip'
import { Table } from '../../components/Table'
import { useApi } from '../../lib/client'
import { formatDateTime } from '../../lib/format'

export function SessionList({ patientId }: { patientId: string }) {
  const { api } = useApi()
  const q = useQuery({ queryKey: ['sessions', patientId], queryFn: () => api.getSessions(patientId) })
  return (
    <section aria-labelledby="sessions">
      <h1 id="sessions" className="text-2xl font-semibold">Sessions</h1>
      <Query q={q}>
        {({ sessions }) => (
          <Table caption="Sessions, newest first" empty="No sessions yet."
            head={['Started', 'Plan', 'Mode', 'Contractions', 'Peak delivered', 'Comfort', 'Pain', 'Events']}
            rows={[...sessions].reverse().map((s) => [
              formatDateTime(s.startedAt), `v${s.planVersion}`, s.mode === 1 ? 'EMG assist' : 'Fixed dose', s.contractionsDone,
              `${s.peakDeliveredMa} mA`, s.comfort === null ? '—' : `${s.comfort}/3`, s.pain === null ? '—' : `${s.pain}/10`,
              <span key="e" className="flex flex-wrap gap-1">{safetyEvents([s]).map((e) => <SafetyChip key={e.kind} kind={e.kind} />)}</span>,
            ])} />
        )}
      </Query>
    </section>
  )
}
