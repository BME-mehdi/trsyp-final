'use client'
import { useEffect, useRef } from 'react'
import type { Plan } from '@symbiomed/domain'
import { PARAMETER_LABEL, type Review } from './review'

type Props = { plan: Plan; review: Review; resumed: boolean; pending: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }

/** Final check before approval: the whole plan, what changed, and the warnings. Native modal dialog (focus trap, Escape). */
export function ApproveDialog({ plan, review: r, resumed, pending, error, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  const f = r.final
  const rows: [string, string, boolean][] = [
    [PARAMETER_LABEL.ceilingMa.name, `${f.ceilingMa} mA`, f.ceilingMa !== plan.ceilingMa],
    [PARAMETER_LABEL.offS.name, `${f.offS} s`, f.offS !== plan.offS],
    [PARAMETER_LABEL.contractions.name, `${f.contractions}`, f.contractions !== plan.contractions],
    ['Floor fraction', `${f.floorFraction}`, f.floorFraction !== plan.floorFraction],
    ['Pulse width', `${f.pulseWidthUs} µs`, f.pulseWidthUs !== plan.pulseWidthUs],
    ['Target activation', `${plan.aTargetPctMvc} %`, false],
    ['Reference MVC', `${f.referenceMvc} mV`, f.referenceMvc !== plan.referenceMvc.value],
    ['Valid for', `${f.validityH} h after approval`, false],
  ]
  return (
    <dialog ref={ref} aria-labelledby="approve-title" onCancel={onCancel} className="m-auto w-full max-w-xl rounded-lg p-6 backdrop:bg-ink/50">
      <h2 id="approve-title" className="text-xl font-semibold">Approve plan version {plan.version + 1}</h2>
      {resumed && <p role="status" className="mt-2">You signed in again. Check the plan and confirm.</p>}
      {r.warnings.length > 0 && (
        <div role="alert" className="mt-4 rounded border-2 border-critical-fg bg-critical-bg p-3 text-critical-fg">
          <p className="font-semibold">Check before approving</p>
          <ul className="mt-1 list-disc pl-5">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      <table className="mt-4 w-full text-left">
        <caption className="sr-only">Final plan</caption>
        <tbody>
          {rows.map(([name, value, changed]) => (
            <tr key={name} className="border-b border-divider">
              <th scope="row" className="py-1 pr-4 font-normal">{name}</th>
              <td className="py-1 font-semibold">{value}{changed && <span className="ml-2 text-sm font-normal text-muted">(changed)</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-muted">Approving needs a sign-in from the last 5 minutes. If yours is older, you will be asked to sign in again first.</p>
      {error && <p role="alert" className="mt-2 font-semibold text-critical-fg">The plan was not approved: {error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="min-h-11 rounded border border-control px-4">Cancel</button>
        <button type="button" onClick={onConfirm} disabled={pending} className="min-h-11 rounded bg-accent px-5 font-semibold text-on-accent disabled:opacity-60">
          {pending ? 'Approving…' : `Approve plan version ${plan.version + 1}`}
        </button>
      </div>
    </dialog>
  )
}
