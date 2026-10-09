import { notFound } from 'next/navigation'
import { mockMode } from '../../server/mock-mode'

/** DEV ONLY: stands in for the Keycloak sign-in pages in mock mode (same demo users, password and one-time code). */
export default async function DevLogin({ searchParams }: { searchParams: Promise<{ returnTo?: string; stepUp?: string; error?: string }> }) {
  if (!mockMode()) notFound()
  const { returnTo = '/', stepUp, error } = await searchParams
  const field = 'mt-1 block min-h-11 w-full rounded border border-control px-3'
  return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-sm text-muted">Mock sign-in (development only)</p>
      <h1 className="text-2xl font-semibold">{stepUp ? 'Confirm it is you' : 'Sign in'}</h1>
      {stepUp && <p className="mt-2">Approving a plan needs a sign-in from the last 5 minutes.</p>}
      {error && <p role="alert" className="mt-3 rounded bg-critical-bg p-3 text-critical-fg">Wrong user name, password or code.</p>}
      <form method="post" action="/api/auth/dev-login" className="mt-4 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        {stepUp && <input type="hidden" name="stepUp" value="1" />}
        <label className="block">User name<input name="username" autoComplete="username" required className={field} /></label>
        <label className="block">Password<input name="password" type="password" autoComplete="current-password" required className={field} /></label>
        <label className="block">One-time code<input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" className={field} /></label>
        <button type="submit" className="min-h-11 rounded bg-accent px-5 font-semibold text-on-accent">{stepUp ? 'Confirm' : 'Sign in'}</button>
      </form>
    </main>
  )
}
