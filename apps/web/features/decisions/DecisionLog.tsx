'use client'
import { useQuery } from '@tanstack/react-query'
import { Query } from '../../components/Query'
import { Table } from '../../components/Table'
import { useApi } from '../../lib/client'
import { formatDateTime } from '../../lib/format'
import { PARAMETER_LABEL } from '../next-session/review'

export function DecisionLog({ patientId }: { patientId: string }) {
  const { api } = useApi()
  const q = useQuery({ queryKey: ['decisions', patientId], queryFn: () => api.getDecisions(patientId) })
  return (
    <section aria-labelledby="decisions">
      <h1 id="decisions" className="text-2xl font-semibold">Decision log</h1>
      <p className="mt-1 text-muted">Every accept or override of a simulated AI suggestion. These decisions are used to retrain the model.</p>
      <Query q={q}>
        {({ decisions }) => (
          <Table caption="Decisions, newest first" empty="No decisions yet."
            head={['When', 'Plan', 'Parameter', 'Suggested', 'Decision', 'Approved', 'Reason', 'By']}
            rows={decisions.map((d) => [
              formatDateTime(d.decidedAt), `v${d.planVersion}`, PARAMETER_LABEL[d.parameter].name, d.suggestedValue,
              d.action === 'accept' ? 'Accepted' : <strong key="o">Overridden</strong>, d.approvedValue, d.reason ?? '—', d.decidedBy,
            ])} />
        )}
      </Query>
    </section>
  )
}
