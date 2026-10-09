import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
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
      <header className="flex flex-wrap items-center gap-4 border-b border-divider px-4 py-3">
        <p className="text-lg font-semibold text-accent">SymbioMed</p>
        <nav aria-label="Main" className="flex gap-4">
          <Link href="/" className="underline-offset-4 hover:underline">Worklist</Link>
          {process.env.NEXT_PUBLIC_FEATURE_BENCH === '1' && <Link href="/bench" className="underline-offset-4 hover:underline">Bench (USB)</Link>}
        </nav>
        <div className="ml-auto">
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </Providers>
  )
}
