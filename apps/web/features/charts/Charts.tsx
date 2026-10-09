'use client'
import { colors } from '@symbiomed/ui-tokens'
import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi } from '../../lib/client'
import { formatDay } from '../../lib/format'

/** Flexion goal shown to clinicians: 110° at week 6 (Model C threshold). To confirm: docs/OPEN_QUESTIONS.md item 16. */
const FLEXION_GOAL_DEG = 110

type Point = { day: string; [k: string]: number | string | null }
type Series = { key: string; name: string; dashed?: boolean; color: string }

function Chart({ id, title, summary, unit, data, series, reference }: { id: string; title: string; summary: string; unit: string; data: Point[]; series: Series[]; reference?: { y: number; label: string } }) {
  return (
    <figure aria-labelledby={id} className="rounded border border-divider p-4">
      <h2 id={id} className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted">{summary}</p>
      <div className="mt-2 h-64" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {/* Hidden from assistive technology and not focusable: the summary and the table carry the values. */}
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid stroke={colors.divider} />
            <XAxis dataKey="day" tick={{ fill: colors.textMuted, fontSize: 13 }} minTickGap={24} />
            <YAxis unit={unit} tick={{ fill: colors.textMuted, fontSize: 13 }} width={56} />
            <Tooltip />
            <Legend />
            {reference && <ReferenceLine y={reference.y} stroke={colors.textMuted} strokeDasharray="2 4" label={{ value: reference.label, fill: colors.textMuted, fontSize: 13, position: 'insideTopLeft' }} />}
            {series.map((s) => (
              <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '6 4' : undefined} dot={false} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-accent">Show the values as a table</summary>
        <table className="mt-2 text-sm">
          <caption className="sr-only">{title}</caption>
          <thead><tr><th scope="col" className="pr-4 text-left">Day</th>{series.map((s) => <th key={s.key} scope="col" className="pr-4 text-left">{s.name}</th>)}</tr></thead>
          <tbody>{data.map((d, i) => <tr key={i}><td className="pr-4">{d.day}</td>{series.map((s) => <td key={s.key} className="pr-4">{d[s.key] ?? '—'}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </figure>
  )
}

export function Charts({ patientId }: { patientId: string }) {
  const { api } = useApi()
  const sessions = useQuery({ queryKey: ['sessions', patientId], queryFn: () => api.getSessions(patientId) })
  const history = useQuery({ queryKey: ['plan-history', patientId], queryFn: () => api.getPlanHistory(patientId) })
  if (sessions.isPending || history.isPending) return <p role="status">Loading…</p>
  if (sessions.isError || history.isError) return <p role="alert" className="text-critical-fg">Could not load the charts. Try again later.</p>
  const ceilingOf = new Map(history.data.plans.map((p) => [p.version, p.ceilingMa]))
  const data: Point[] = sessions.data.sessions.map((s) => ({
    day: formatDay(s.startedAt),
    flexion: s.flexionMaxDeg,
    activation: s.perContraction.length ? Math.round((10 * s.perContraction.reduce((a, c) => a + c.aV, 0)) / s.perContraction.length) / 10 : null,
    fatigue: s.fatigueMdfDropPct,
    ceiling: ceilingOf.get(s.planVersion) ?? null,
    peak: s.peakDeliveredMa,
  }))
  const last = sessions.data.sessions.at(-1)
  const aTarget = history.data.plans.at(-1)?.aTargetPctMvc ?? 30
  return (
    <section aria-labelledby="charts" className="space-y-6">
      <h1 id="charts" className="text-2xl font-semibold">Charts</h1>
      <div className="grid gap-6 xl:grid-cols-2">
        <Chart id="c-flexion" title="Knee flexion versus goal" unit="°" data={data} reference={{ y: FLEXION_GOAL_DEG, label: `goal ${FLEXION_GOAL_DEG}° (to confirm)` }}
          summary={last ? `Latest ${last.flexionMaxDeg}°; goal ${FLEXION_GOAL_DEG}° at week 6.` : 'No sessions yet.'}
          series={[{ key: 'flexion', name: 'Maximum flexion', color: colors.accent }]} />
        <Chart id="c-activation" title="Voluntary activation" unit="%" data={data} reference={{ y: aTarget, label: `target ${aTarget} %` }}
          summary="Session mean, % of the reference MVC (EMG with the stimulator off)."
          series={[{ key: 'activation', name: 'Mean activation', color: colors.accent }]} />
        <Chart id="c-fatigue" title="Fatigue (median-frequency drop)" unit="%" data={data}
          summary="Drop of the EMG median frequency across each session; gaps are sessions without a valid EMG window."
          series={[{ key: 'fatigue', name: 'Median-frequency drop', color: colors.accent }]} />
        <Chart id="c-current" title="Approved ceiling versus peak delivered" unit=" mA" data={data}
          summary="Dashed: approved ceiling of the plan each session ran on. Solid: peak current delivered."
          series={[{ key: 'ceiling', name: 'Approved ceiling', dashed: true, color: colors.textMuted }, { key: 'peak', name: 'Peak delivered', color: colors.accent }]} />
      </div>
    </section>
  )
}
