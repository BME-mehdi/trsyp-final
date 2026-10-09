'use client'
import type { WorklistRow } from '@symbiomed/api-client'
import type { SessionSummary } from '@symbiomed/domain'
import { useQueries, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PlanChip } from '../../components/StatusChip'
import { Query } from '../../components/Query'

import { useApi } from '../../lib/client'
import { FLEXION_GOAL_DEG } from '../charts/goal'
import { triage, type Flag, type Triage } from './flags'
import { KneeArc, SessionTally } from './marks'

const FlagChip = ({ f }: { f: Flag }) => (
  <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold whitespace-nowrap ${f.tone === 'critical' ? 'bg-critical-bg text-critical-fg' : 'bg-caution-bg text-caution-fg'}`}>{f.label}</span>
)

type Row = { p: WorklistRow; s: SessionSummary[] | undefined; tri: Triage | null; order: number }
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The opening lines read like a shift handover: what waits for the clinician, in order. */
function Handover({ rows }: { rows: Row[] }) {
  const pending = rows.filter((r) => r.p.pendingSuggestion).length
  const flagged = rows.filter((r) => r.tri?.flags.some((f) => f.tone === 'critical')).length
  const expired = rows.filter((r) => !r.p.plan || r.p.plan.status === 'expired').length
  const lines = [
    pending > 0 && `${plural(pending, 'plan waits', 'plans wait')} for your approval.`,
    flagged > 0 && `${plural(flagged, 'patient', 'patients')} had pain at 4/10 or more, or pressed STOP, in the last 7 days.`,
    expired > 0 && `${plural(expired, 'plan has', 'plans have')} expired or not been set: the brace will not start a session.`,
  ].filter(Boolean) as string[]
  return (
    <div className="mt-4 max-w-3xl space-y-1 text-lg">
      {lines.length === 0 ? <p>Nothing waits for you. Every plan is current and no safety flag was raised this week.</p> : lines.map((l) => <p key={l}>{l}</p>)}
    </div>
  )
}

export function Worklist() {
  const { api } = useApi()
  const q = useQuery({ queryKey: ['patients'], queryFn: () => api.listPatients() })
  const ids = q.data?.patients.map((p) => p.patientId) ?? []
  // Triage reads each patient's sessions through the existing route (same cache as the patient pages).
  const sessions = useQueries({ queries: ids.map((id) => ({ queryKey: ['sessions', id], queryFn: () => api.getSessions(id) })) })
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  return (
    <section aria-labelledby="worklist">
      <p className="text-muted">{today}</p>
      <h1 id="worklist" className="text-3xl font-bold">Worklist</h1>
      <Query q={q}>
        {({ patients }) => {
          const rows: Row[] = patients.map((p, i) => {
            const s = sessions[i]?.data?.sessions
            const tri = s ? triage(s, p.plan, now) : null
            return { p, s, tri, order: (p.pendingSuggestion ? 1000 : 0) + (tri?.score ?? 0) * 10 + (p.plan?.status === 'expired' || !p.plan ? 2 : 0) }
          }).sort((a, b) => b.order - a.order || a.p.label.localeCompare(b.p.label))
          return (
            <>
              <Handover rows={rows} />
              <p className="mt-2 text-sm text-muted">Sorted by what needs you first. Rest-day requests from the patient app are a demo and are not shown here yet.</p>
              <div className="mt-6 overflow-x-auto rounded-xl border border-divider bg-page">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-divider text-sm text-muted">
                      {['Patient', 'Needs attention', `Knee bend (goal ${FLEXION_GOAL_DEG}°, to confirm)`, 'Sessions, last 7 days', 'Last pain', 'Plan expires', ''].map((h, i) => (
                        <th key={h || i} scope="col" className="px-4 py-3 font-semibold">{h || <span className="sr-only">Action</span>}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ p, s, tri }) => {
                      const flex = s?.at(-1)?.flexionMaxDeg
                      return (
                        <tr key={p.patientId} className="border-b border-divider last:border-b-0 hover:bg-surface/60">
                          <th scope="row" className="min-w-[12rem] px-4 py-4 align-top">
                            <Link href={`/patients/${p.patientId}`} className="text-lg font-bold text-accent underline-offset-4 hover:underline">{p.label}</Link>
                            <span className="block text-sm font-normal text-muted">{p.plan ? `Plan v${p.plan.version}, ceiling ${p.plan.ceilingMa} mA` : 'No plan yet'}</span>
                          </th>
                          <td className="px-4 py-4 align-top">
                            <span className="flex max-w-xs flex-wrap gap-1.5">
                              {p.pendingSuggestion && <PlanChip status="pending" />}
                              {p.plan?.status === 'expired' && <PlanChip status="expired" />}
                              {tri?.flags.filter((f) => f.id !== 'expired').map((f) => <FlagChip key={f.id} f={f} />)}
                              {tri && !p.pendingSuggestion && p.plan?.status !== 'expired' && tri.flags.length === 0 && <span className="text-muted">Nothing new</span>}
                              {!tri && <span className="text-muted">Loading…</span>}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            {flex === undefined ? '—' : <span className="flex items-center gap-2"><KneeArc deg={flex} goal={FLEXION_GOAL_DEG} /><span className="tabular-nums">{Math.round(flex)}°</span></span>}
                          </td>
                          <td className="px-4 py-4 align-top">
                            {s && tri ? <span className="flex items-center gap-3"><SessionTally sessions={s} now={now} /><span className="whitespace-nowrap tabular-nums">{tri.adherence.done} of {tri.adherence.planned}</span></span> : '—'}
                          </td>
                          <td className="px-4 py-4 align-top whitespace-nowrap tabular-nums">{tri?.lastPain == null ? '—' : `${tri.lastPain}/10`}</td>
                          <td className="px-4 py-4 align-top whitespace-nowrap tabular-nums">{p.plan ? shortDate.format(new Date(p.plan.expiresAt)) : '—'}</td>
                          <td className="px-4 py-4 text-right align-top">
                            <Link href={`/patients/${p.patientId}`} className={`inline-flex min-h-11 items-center rounded-lg px-4 font-semibold whitespace-nowrap ${p.pendingSuggestion ? 'bg-accent text-on-accent hover:bg-deep' : 'border border-control hover:border-accent hover:text-accent'}`}>
                              {p.pendingSuggestion ? 'Review plan' : 'Open'}<span className="sr-only"> for {p.label}</span>
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        }}
      </Query>
    </section>
  )
}
