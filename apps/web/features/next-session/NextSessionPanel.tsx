'use client'
import { ApiError } from '@symbiomed/api-client'
import { LIMITS, PLAN_PARAMETERS, isPlanExpired, type AiSuggestion, type Plan, type PlanParameter, type SessionSummary } from '@symbiomed/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { PlanChip } from '../../components/StatusChip'
import { useApi } from '../../lib/client'
import { formatDateTime } from '../../lib/format'
import { ApproveDialog } from './ApproveDialog'
import { CLAMP_TEXT, PARAMETER_LABEL, initialDraft, review, type Draft } from './review'

const draftKey = (suggestionId: string) => `symbiomed-draft:${suggestionId}`
const input = 'min-h-11 rounded border border-control px-2'

export function NextSessionPanel({ patientId }: { patientId: string }) {
  const { api } = useApi()
  const plan = useQuery({ queryKey: ['plan', patientId], queryFn: () => api.getPlan(patientId) })
  const suggestion = useQuery({ queryKey: ['suggestion', patientId], queryFn: () => api.getSuggestion(patientId) })
  const sessions = useQuery({ queryKey: ['sessions', patientId], queryFn: () => api.getSessions(patientId) })
  const [approved, setApproved] = useState<Plan | null>(null)

  if (plan.isPending || suggestion.isPending || sessions.isPending) return <p role="status">Loading…</p>
  if (plan.isError || suggestion.isError || sessions.isError) return <p role="alert" className="text-critical-fg">Could not load this patient. Try again later.</p>
  const current = plan.data.plan
  const s = suggestion.data.suggestion
  return (
    <section aria-labelledby="next-session">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="next-session" className="text-2xl font-semibold">Next session plan</h1>
        {current && <PlanChip status={isPlanExpired(current, new Date()) ? 'expired' : 'active'} />}
        {current && <span className="text-muted">current v{current.version}, valid until {formatDateTime(current.expiresAt)}</span>}
      </div>
      {approved && (
        <p role="status" className="mt-4 rounded bg-positive-bg p-3 text-positive-fg">
          Plan version {approved.version} approved. It reaches the brace at the next sync.
        </p>
      )}
      {!current && <p className="mt-4">No approved plan yet. The first plan is set at the clinic visit.</p>}
      {current && !s && !approved && <p className="mt-4">No AI suggestion is waiting for review.</p>}
      {current && s && <Review key={s.suggestionId} plan={current} suggestion={s} last={sessions.data.sessions.at(-1) ?? null} onApproved={setApproved} />}
    </section>
  )
}

function Review({ plan, suggestion: s, last, onApproved }: { plan: Plan; suggestion: AiSuggestion; last: SessionSummary | null; onApproved: (p: Plan) => void }) {
  const { api, session } = useApi()
  const queryClient = useQueryClient()
  const resume = useSearchParams().get('resume') === '1'
  const [draft, setDraft] = useState<Draft>(() => initialDraft(plan))
  const [open, setOpen] = useState(false)
  const r = useMemo(() => review(draft, plan, s, last, session.practitionerId), [draft, plan, s, last, session.practitionerId])

  // Back from the step-up sign-in: restore the decisions and reopen the confirmation.
  useEffect(() => {
    const saved = resume ? sessionStorage.getItem(draftKey(s.suggestionId)) : null
    if (saved) {
      setDraft(JSON.parse(saved) as Draft)
      setOpen(true)
    }
  }, [resume, s.suggestionId])

  const approve = useMutation({
    mutationFn: () => api.approvePlan(plan.patientId, r.request!),
    onSuccess: (res) => {
      sessionStorage.removeItem(draftKey(s.suggestionId))
      setOpen(false)
      onApproved(res.plan)
      void queryClient.invalidateQueries()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'step_up_required') {
        // Decisions are kept in this tab only (sessionStorage), then the clinician signs in again.
        sessionStorage.setItem(draftKey(s.suggestionId), JSON.stringify(draft))
        window.location.assign(`/api/auth/login?${new URLSearchParams({ stepUp: '1', returnTo: `/patients/${plan.patientId}?resume=1` })}`)
      }
    },
  })

  const setChoice = (p: PlanParameter, patch: Partial<Draft['choices'][PlanParameter]>) =>
    setDraft((d) => ({ ...d, choices: { ...d.choices, [p]: { ...d.choices[p], ...patch } } }))

  return (
    <>
      <div className="mt-2 flex items-center gap-2">
        <PlanChip status={r.decided > 0 ? 'draft' : 'pending'} />
        <span className="text-muted">{r.decided} of {PLAN_PARAMETERS.length} parameters decided</span>
      </div>
      <table className="mt-4 w-full border-collapse text-left">
        <caption className="sr-only">AI suggestion for the next plan, one row per parameter</caption>
        <thead className="border-b-2 border-divider">
          <tr>
            <th scope="col" className="px-2 py-2">Parameter</th>
            <th scope="col" className="px-2 py-2">Current plan</th>
            <th scope="col" className="px-2 py-2">AI suggestion <span className="font-normal text-muted">(simulated)</span></th>
            <th scope="col" className="px-2 py-2">Your decision</th>
          </tr>
        </thead>
        <tbody>
          {PLAN_PARAMETERS.map((p) => {
            const { name, unit } = PARAMETER_LABEL[p]
            const c = draft.choices[p]
            const sv = s[p]
            const errId = `${p}-error`
            return (
              <tr key={p} className="border-b border-divider align-top">
                <th scope="row" className="px-2 py-3 font-semibold">{name}</th>
                <td className="px-2 py-3 text-lg">{plan[p]} {unit}</td>
                <td className="px-2 py-3">
                  <p className="text-lg font-semibold">{sv.value} {unit} <span className="rounded bg-neutral-bg px-1 text-sm font-normal text-neutral-fg">simulated</span></p>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {sv.reasons.map((x) => <li key={x.feature}>{x.text}</li>)}
                  </ul>
                  {sv.clampReason && <p className="mt-1 text-sm"><strong>Clamped by rule:</strong> {CLAMP_TEXT[sv.clampReason]}</p>}
                </td>
                <td className="px-2 py-3">
                  <fieldset>
                    <legend className="sr-only">Decision on {name}</legend>
                    <div className="flex gap-4">
                      {(['accept', 'override'] as const).map((a) => (
                        <label key={a} className="inline-flex min-h-11 items-center gap-2">
                          <input type="radio" name={`${p}-action`} checked={c.action === a} onChange={() => setChoice(p, { action: a })} className="size-5" />
                          {a === 'accept' ? 'Accept' : 'Override'}
                        </label>
                      ))}
                    </div>
                    {c.action === 'override' && (
                      <div className="mt-2 space-y-2">
                        <label className="block text-sm">
                          New value {unit && `(${unit})`}
                          {p === 'ceilingMa' ? (
                            <input type="number" inputMode="numeric" min={LIMITS.ceilingMa.min} max={LIMITS.ceilingMa.max} step={LIMITS.ceilingMa.step}
                              value={c.value} onChange={(e) => setChoice(p, { value: e.target.value })}
                              aria-invalid={r.errors[p] ? true : undefined} aria-describedby={r.errors[p] ? errId : undefined} className={`${input} ml-2 w-24`} />
                          ) : (
                            <select value={c.value} onChange={(e) => setChoice(p, { value: e.target.value })} className={`${input} ml-2`}
                              aria-invalid={r.errors[p] ? true : undefined} aria-describedby={r.errors[p] ? errId : undefined}>
                              <option value="">Choose</option>
                              {(p === 'offS' ? LIMITS.offS.allowed : LIMITS.contractions.allowed).map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          )}
                        </label>
                        {r.errors[p] && <p id={errId} className="text-sm font-semibold text-critical-fg">{r.errors[p]}</p>}
                        <label className="block text-sm">
                          Reason (required, no names or personal details)
                          <textarea value={c.reason} maxLength={280} rows={2} onChange={(e) => setChoice(p, { reason: e.target.value })}
                            aria-invalid={r.errors[`${p}Reason`] ? true : undefined} className="mt-1 block w-full rounded border border-control p-2" />
                        </label>
                        {r.errors[`${p}Reason`] && <p className="text-sm font-semibold text-critical-fg">{r.errors[`${p}Reason`]}</p>}
                      </div>
                    )}
                  </fieldset>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="plan-fields">
          <h2 id="plan-fields" className="text-lg font-semibold">Other plan fields (set by the clinician)</h2>
          <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
            {([
              ['floorFraction', 'Floor fraction of the ceiling', `${LIMITS.floorFraction.min}–${LIMITS.floorFraction.max}`, 0.05],
              ['pulseWidthUs', 'Pulse width (µs)', `${LIMITS.pulseWidthUs.min}–${LIMITS.pulseWidthUs.max}`, 10],
              ['validityH', 'Plan valid for (hours)', `${LIMITS.validityH.min}–${LIMITS.validityH.max}`, 1],
              ['referenceMvc', 'Reference MVC (mV, can only go up)', `at least ${plan.referenceMvc.value}`, 0.01],
            ] as const).map(([f, label, range, step]) => (
              <label key={f} className="contents">
                <span>{label} <span className="text-sm text-muted">({range})</span></span>
                <span>
                  <input type="number" step={step} value={draft[f]} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
                    aria-invalid={r.errors[f] ? true : undefined} className={`${input} w-28`} />
                  {r.errors[f] && <span className="ml-2 text-sm font-semibold text-critical-fg">{r.errors[f]}</span>}
                </span>
              </label>
            ))}
            <span>Target activation</span><span>{plan.aTargetPctMvc} % of reference MVC (fixed until confirmed)</span>
          </div>
        </section>
        <section aria-labelledby="fixed">
          <h2 id="fixed" className="text-lg font-semibold">Fixed parameters (read-only)</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt>Frequency</dt><dd>{LIMITS.frequencyHz} Hz</dd>
            <dt>Ramp up, hold, ramp down</dt><dd>{LIMITS.rampUpS} s, {LIMITS.holdS} s, {LIMITS.rampDownS} s</dd>
            <dt>Sessions</dt><dd>{LIMITS.sessionsPerDay} a day, at least {LIMITS.minGapH} h apart (the brace enforces this)</dd>
          </dl>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" disabled={!r.complete} onClick={() => setOpen(true)}
          className="min-h-11 rounded bg-accent px-5 font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-neutral-bg disabled:text-neutral-fg">
          Review and approve
        </button>
        {!r.complete && <span className="text-muted">Decide every parameter and fix the fields marked in red to continue.</span>}
      </div>

      {open && r.request && (
        <ApproveDialog plan={plan} review={r} resumed={resume} pending={approve.isPending}
          error={approve.error instanceof ApiError && approve.error.code !== 'step_up_required' ? approve.error.message : null}
          onCancel={() => setOpen(false)} onConfirm={() => approve.mutate()} />
      )}
    </>
  )
}
