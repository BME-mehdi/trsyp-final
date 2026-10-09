const field = 'mt-1.5 block h-12 w-full rounded-lg border border-control bg-page px-3 text-base focus:border-accent'

/** The mock identity provider's form (dev and demo only). Posts to /api/auth/dev-login. */
export function LoginForm({ returnTo, stepUp, error, askOtp, demo }: { returnTo: string; stepUp: boolean; error: boolean; askOtp: boolean; demo: boolean }) {
  return (
    <div>
      <h1 className="text-3xl font-bold">{stepUp ? 'Confirm it is you' : 'Sign in'}</h1>
      <p className="mt-2 text-muted">{stepUp ? 'Approving a plan needs a sign-in from the last 5 minutes.' : 'Use your clinic account.'}</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-critical-bg p-3 text-critical-fg">{askOtp ? 'Wrong user name, password or code.' : 'Wrong user name or password.'}</p>}
      <form method="post" action="/api/auth/dev-login" className="mt-6 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        {stepUp && <input type="hidden" name="stepUp" value="1" />}
        <label className="block font-semibold">User name<input name="username" autoComplete="username" required className={field} /></label>
        <label className="block font-semibold">Password<input name="password" type="password" autoComplete="current-password" required className={field} /></label>
        {askOtp && <label className="block font-semibold">One-time code<input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" className={field} /></label>}
        <button type="submit" className="h-12 w-full rounded-lg bg-accent font-semibold text-on-accent hover:bg-deep">{stepUp ? 'Confirm' : 'Sign in'}</button>
      </form>
      {demo && (
        <form method="post" action="/api/auth/dev-login" className="mt-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          {stepUp && <input type="hidden" name="stepUp" value="1" />}
          <input type="hidden" name="username" value="clinician.demo" />
          <input type="hidden" name="password" value="demo-clinician" />
          <button type="submit" className="h-12 w-full rounded-lg border-2 border-control font-semibold hover:border-accent hover:text-accent">Continue as the demo clinician</button>
        </form>
      )}
      <p className="mt-6 rounded-lg bg-surface p-3 text-sm text-muted">
        {demo ? 'Demo mode: the one-time code is turned off. Synthetic patients only.' : 'Mock sign-in for development. Synthetic patients only.'}
      </p>
    </div>
  )
}
