import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppNav } from '../../components/AppNav'
import { SignOutButton } from '../../components/SignOutButton'
import { Providers } from '../../lib/client'
import { IDLE_TIMEOUT_S, SESSION_COOKIE, readSession } from '../../server/session'

export const dynamic = 'force-dynamic'

/** Every clinician page needs a live session; the API checks again on each call. */
export default async function ClinicianLayout({ children }: { children: ReactNode }) {
  const id = (await cookies()).get(SESSION_COOKIE)?.value
  const s = readSession(id)
  if (!s) redirect(id ? '/signin?reason=idle' : '/signin')
  if (s.principal.role !== 'clinician' || !s.principal.practitionerId) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">This site is for clinicians</h1>
        <p className="mt-2">Patients use the SymbioMed app.</p>
      </main>
    )
  }
  return (
    <Providers session={{ csrf: s.csrf, practitionerId: s.principal.practitionerId, idleTimeoutS: IDLE_TIMEOUT_S }}>
      <div className="lg:grid lg:min-h-[calc(100vh-42px)] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="flex flex-wrap items-center gap-4 border-b border-divider bg-page px-5 py-3 lg:sticky lg:top-0 lg:h-[calc(100vh-42px)] lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-8 lg:border-r lg:border-b-0 lg:py-6">
          <p className="flex items-center gap-2.5 text-lg font-bold">
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-deep text-on-accent">
              <svg viewBox="0 0 24 24" className="h-5 w-5"><path d="M4 18 A 8 8 0 0 1 20 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="M12 18 L 17 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
            </span>
            <span>SymbioMed <span className="block text-sm font-normal text-muted">Clinician</span></span>
          </p>
          <AppNav bench={process.env.NEXT_PUBLIC_FEATURE_BENCH === '1'} />
          <div className="ml-auto flex items-center gap-3 lg:mt-auto lg:ml-0 lg:flex-col lg:items-stretch">
            <p className="text-sm text-muted">Signed in as {s.principal.practitionerId}</p>
            <SignOutButton />
          </div>
        </aside>
        <main className="min-w-0 bg-surface px-5 py-8 lg:px-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </Providers>
  )
}
