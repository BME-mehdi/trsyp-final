import type { ReactNode } from 'react'
import { Goniometer } from './Goniometer'

/** Sign-in layout: a deep-blue panel with the goniometer motif, and the form column. Stacks on narrow screens. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-42px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section aria-label="About SymbioMed" className="flex flex-col justify-between gap-10 bg-deep px-8 py-10 text-on-accent lg:px-14 lg:py-14">
        <p className="flex items-center gap-3 text-xl font-bold">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-on-accent text-deep">
            <svg viewBox="0 0 24 24" className="h-5 w-5"><path d="M4 18 A 8 8 0 0 1 20 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="M12 18 L 17 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </span>
          SymbioMed
        </p>
        <div className="max-w-xl">
          <Goniometer className="w-full max-w-md text-on-accent" />
          <h2 className="mt-8 text-3xl font-bold leading-tight lg:text-4xl">Review each patient&apos;s sessions. Approve the next plan, one setting at a time.</h2>
          <p className="mt-4 text-lg text-on-accent/85">The AI suggests (simulated). You decide every parameter, and every decision is logged.</p>
        </div>
        <p className="text-sm text-on-accent/85">Knee rehabilitation after total knee replacement, with a brace that stimulates the thigh muscle.</p>
      </section>
      <section className="flex items-center justify-center bg-page px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  )
}
