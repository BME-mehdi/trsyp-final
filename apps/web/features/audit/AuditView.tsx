'use client'
import { useQuery } from '@tanstack/react-query'
import { Query } from '../../components/Query'
import { Table } from '../../components/Table'
import { useApi } from '../../lib/client'
import { formatDateTime } from '../../lib/format'

const ACTION: Record<string, string> = { read: 'Read', 'search-type': 'Search', create: 'Create', update: 'Update', delete: 'Delete' }

export function AuditView({ patientId }: { patientId: string }) {
  const { api } = useApi()
  const q = useQuery({ queryKey: ['audit', patientId], queryFn: () => api.getAudit(patientId) })
  return (
    <section aria-labelledby="audit">
      <h1 id="audit" className="text-2xl font-semibold">Audit</h1>
      <p className="mt-1 text-muted">The latest 100 reads and writes of this patient&apos;s data. Records hold identifiers only.</p>
      <Query q={q}>
        {({ events }) => (
          <Table caption="Audit entries, newest first" empty="No audit entries."
            head={['When', 'Action', 'Outcome', 'By', 'Records']}
            rows={events.map((e) => [
              formatDateTime(e.recorded), ACTION[e.interaction] ?? e.interaction, e.outcome === '0' ? 'Done' : <strong key="d">Refused</strong>, e.agent,
              <span key="r" className="font-mono text-sm break-all">{e.entities.join(', ')}</span>,
            ])} />
        )}
      </Query>
    </section>
  )
}
