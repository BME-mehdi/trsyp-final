import { AuthShell } from '../../components/AuthShell'
import { LoginForm } from '../../components/LoginForm'
import { demoNoOtp } from '../../server/mock-mode'

const REASON: Record<string, string> = {
  idle: 'You were signed out after 15 minutes without activity.',
  'signed-out': 'You are signed out.',
}

export default async function SignIn({ searchParams }: { searchParams: Promise<{ reason?: string; returnTo?: string }> }) {
  const { reason, returnTo } = await searchParams
  const message = reason ? REASON[reason] : undefined
  const status = message && <p role="status" className="mb-6 rounded-lg bg-info-bg p-3 text-info-fg">{message}</p>
  // Demo mode: the form is on this page (one step less on camera). Otherwise the clinic's identity provider.
  if (demoNoOtp()) return <AuthShell>{status}<LoginForm returnTo={returnTo ?? '/'} stepUp={false} error={false} askOtp={false} demo /></AuthShell>
  return (
    <AuthShell>
      {status}
      <h1 className="text-3xl font-bold">Sign in</h1>
      <p className="mt-2 text-muted">Sign in with your clinic account. A second factor (one-time code) is required.</p>
      <a href={`/api/auth/login?${new URLSearchParams({ returnTo: returnTo ?? '/' })}`} className="mt-8 flex h-12 w-full items-center justify-center rounded-lg bg-accent font-semibold text-on-accent hover:bg-deep">
        Sign in
      </a>
    </AuthShell>
  )
}
