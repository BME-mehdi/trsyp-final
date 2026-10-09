const REASON: Record<string, string> = {
  idle: 'You were signed out after 15 minutes without activity.',
  'signed-out': 'You are signed out.',
}

export default async function SignIn({ searchParams }: { searchParams: Promise<{ reason?: string; returnTo?: string }> }) {
  const { reason, returnTo } = await searchParams
  const message = reason ? REASON[reason] : undefined
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">SymbioMed clinician sign-in</h1>
      {message && <p role="status" className="mt-4 rounded bg-surface p-3">{message}</p>}
      <p className="mt-4">Sign in with your clinic account. A second factor (one-time code) is required.</p>
      <a href={`/api/auth/login?${new URLSearchParams({ returnTo: returnTo ?? '/' })}`} className="mt-6 inline-flex min-h-11 items-center rounded bg-accent px-5 font-semibold text-on-accent">
        Sign in
      </a>
    </main>
  )
}
