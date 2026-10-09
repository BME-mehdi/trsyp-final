'use client'
import { useQueries, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PlanChip } from '../../components/StatusChip'
import { Query } from '../../components/Query'
import { formatDateTime } from '../../lib/format'
import { useApi } from '../../lib/client'
import { triage, type Flag, type Triage } from './flags'

const FlagChip = ({ f }: { f: Flag }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold ${f.tone === 'critical' ? 'bg-critical-bg text-critical-fg' : 'bg-caution-bg text-caution-fg'}`}>{f.label}</span>
)

export function Worklist() {
  const { api } = useApi()
  const q = useQuery({ queryKey: ['patients'], queryFn: () => api.listPatients() })
  const ids = q.data?.patients.map((p) => p.patientId) ?? []
  // Triage reads each patient's sessions through the existing route (same cache as the patient pages).
  const sessions = useQueries({ queries: ids.map((id) => ({ queryKey: ['sessions', id], queryFn: () => api.getSessions(id) })) })
  const now = new Date()
  return (
    <section aria-labelledby="worklist">
      <h1 id="worklist" className="text-2xl font-semibold">Worklist</h1>
      <p className="mt-1 text-muted">Sorted by what needs attention: pending approvals first, then flags, then expired or missing plans. Flags cover the last 7 days.</p>
      <p className="mt-1 text-sm text-muted">Rest-day requests: demo only in the patient app, not recorded here yet.</p>
      <Query q={q}>
        {({ patients }) => {
          const rows = patients.map((p, i) => {
            const s = sessions[i]?.data?.sessions
            const tri: Triage | null = s ? triage(s, p.plan, now) : null
            const order = (p.pendingSuggestion ? 1000 : 0) + (tri?.score ?? 0) * 10 + (p.plan?.status === 'expired' || !p.plan ? 2 : 0)
            return { p, tri, order }
          }).sort((a, b) => b.order - a.order || a.p.label.localeCompare(b.p.label))
          return (
            <div className="mt-4 overflow-x-auto rounded-xl shadow-card">
              <table className="w-full border-collapse text-left">
                <thead className="border-b-2 border-divider bg-surface">
                  <tr>
                    {['Patient', 'Flags', 'Status', 'Sessions, last 7 days', 'Last pain', 'Plan', 'Expires', 'Last session'].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, tri }) => (
                    <tr key={p.patientId} className="border-b border-divider">
                      <th scope="row" className="px-3 py-2 font-semibold">
                        <Link href={`/patients/${p.patientId}`} className="text-accent underline underline-offset-4">{p.label}</Link>
                      </th>
                      <td className="px-3 py-2">
                        {!tri ? <span className="text-muted">Loading…</span> : tri.flags.length === 0 ? 'None' : (
                          <span className="flex flex-wrap gap-1">{tri.flags.map((f) => <FlagChip key={f.id} f={f} />)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap gap-1">
                          {p.pendingSuggestion && <PlanChip status="pending" />}
                          {p.plan && <PlanChip status={p.plan.status} />}
                          {!p.plan && <span>No plan</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2">{tri ? `${tri.adherence.done} of ${tri.adherence.planned}` : '—'}</td>
                      <td className="px-3 py-2">{tri?.lastPain == null ? '—' : `${tri.lastPain}/10`}</td>
                      <td className="px-3 py-2">{p.plan ? `v${p.plan.version}, ${p.plan.ceilingMa} mA` : '—'}</td>
                      <td className="px-3 py-2">{p.plan ? formatDateTime(p.plan.expiresAt) : '—'}</td>
                      <td className="px-3 py-2">{p.lastSessionAt ? formatDateTime(p.lastSessionAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }}
      </Query>
    </section>
  )
}
