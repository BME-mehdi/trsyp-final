'use client'
import { useQueries } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { useApi } from '../../lib/client'
import { buildFacts } from './facts'
import { guardReport, templateReport } from './report'

/** Weekly report tab. A deterministic template over the facts (no language model call in this build). */
export function WeeklyReport({ patientId }: { patientId: string }) {
  const { api } = useApi()
  const [sessions, plan, suggestion] = useQueries({
    queries: [
      { queryKey: ['sessions', patientId], queryFn: () => api.getSessions(patientId) },
      { queryKey: ['plan', patientId], queryFn: () => api.getPlan(patientId) },
      { queryKey: ['suggestion', patientId], queryFn: () => api.getSuggestion(patientId) },
    ],
  })
  const [vote, setVote] = useState<'useful' | 'not-useful' | null>(null)
  if (sessions.isPending || plan.isPending || suggestion.isPending) return <p aria-busy="true">Loading…</p>
  if (sessions.isError || plan.isError || suggestion.isError) return <p role="alert">Could not load the data for the report.</p>
  const facts = buildFacts(sessions.data.sessions, plan.data.plan, suggestion.data.suggestion, new Date())
  const report = templateReport(facts)
  const guard = guardReport(report, facts)
  const base = `/patients/${patientId}`
  const byId = new Map(facts.map((f) => [f.id, f]))
  return (
    <section aria-labelledby="report" className="max-w-3xl space-y-6">
      <div>
        <h2 id="report" className="text-xl font-semibold">Weekly report</h2>
        <p className="mt-2 inline-block rounded-full bg-caution-bg px-3 py-1 text-sm font-semibold text-caution-fg">AI draft, demo data: check against the charts</p>
        <p className="mt-2 text-sm text-muted">Built from a fixed template over the facts below. No language model was called. Topics to review only; it never proposes parameter values.</p>
      </div>
      {!guard.ok ? <p role="alert">Report withheld by the guard ({guard.reason}).</p> : (
        <>
          <div className="rounded-xl bg-surface p-4 shadow-card">{report.summary.map((s) => <p key={s} className="mt-1 first:mt-0">{s}</p>)}</div>
          <div>
            <h3 className="font-semibold">Points to discuss</h3>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              {report.points.map((p) => (
                <li key={p.text}>{p.text}{' '}
                  <span className="text-sm text-muted">(based on {p.factIds.map((id, i) => {
                    const f = byId.get(id)
                    return <span key={id}>{i > 0 && ', '}{f?.link ? <Link className="text-accent underline underline-offset-4" href={`${base}/${f.link}`}>{id}</Link> : id}</span>
                  })})</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">Questions for the next visit</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">{report.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </div>
        </>
      )}
      <details className="rounded-xl border border-divider p-4">
        <summary className="cursor-pointer font-semibold">Facts used (IDs only, no free text)</summary>
        <table className="mt-3 w-full text-left text-sm">
          <tbody>{facts.map((f) => <tr key={f.id} className="border-b border-divider"><th scope="row" className="py-1 pr-3 font-semibold">{f.id}</th><td className="py-1 pr-3">{f.label}</td><td className="py-1">{f.value}</td></tr>)}</tbody>
        </table>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <span>Was this draft useful?</span>
        {(['useful', 'not-useful'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={vote === v} onClick={() => setVote(v)}
            className={`min-h-11 rounded-md border-2 px-3 ${vote === v ? 'border-accent font-semibold text-accent' : 'border-control'}`}>{v === 'useful' ? 'Useful' : 'Not useful'}</button>
        ))}
        <span className="text-sm text-muted">Demo: the vote is not logged yet.</span>
      </div>
    </section>
  )
}
