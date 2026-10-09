'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PlanChip } from '../../components/StatusChip'
import { Query } from '../../components/Query'
import { formatDateTime } from '../../lib/format'
import { useApi } from '../../lib/client'

export function Worklist() {
  const { api } = useApi()
  const q = useQuery({ queryKey: ['patients'], queryFn: () => api.listPatients() })
  return (
    <section aria-labelledby="worklist">
      <h1 id="worklist" className="text-2xl font-semibold">Worklist</h1>
      <p className="mt-1 text-muted">Pending approvals first, then expired or missing plans.</p>
      <Query q={q}>
        {({ patients }) => (
          <table className="mt-4 w-full border-collapse text-left">
            <thead className="border-b-2 border-divider">
              <tr>
                {['Patient', 'Status', 'Plan', 'Expires', 'Last session', 'Safety events since approval'].map((h) => (
                  <th key={h} scope="col" className="px-2 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.patientId} className="border-b border-divider">
                  <th scope="row" className="px-2 py-2 font-semibold">
                    <Link href={`/patients/${p.patientId}`} className="text-accent underline underline-offset-4">{p.label}</Link>
                  </th>
                  <td className="px-2 py-2">
                    <span className="flex flex-wrap gap-1">
                      {p.pendingSuggestion && <PlanChip status="pending" />}
                      {p.plan && <PlanChip status={p.plan.status} />}
                      {!p.plan && <span>No plan</span>}
                    </span>
                  </td>
                  <td className="px-2 py-2">{p.plan ? `v${p.plan.version}, ${p.plan.ceilingMa} mA` : '—'}</td>
                  <td className="px-2 py-2">{p.plan ? formatDateTime(p.plan.expiresAt) : '—'}</td>
                  <td className="px-2 py-2">{p.lastSessionAt ? formatDateTime(p.lastSessionAt) : '—'}</td>
                  <td className="px-2 py-2">{p.safetyEventsSinceApproval === 0 ? 'None' : <strong>{p.safetyEventsSinceApproval}</strong>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Query>
    </section>
  )
}
