import { notFound } from 'next/navigation'
import { AuthShell } from '../../components/AuthShell'
import { LoginForm } from '../../components/LoginForm'
import { demoNoOtp, mockMode } from '../../server/mock-mode'

/** DEV ONLY: stands in for the Keycloak sign-in pages in mock mode (same demo users, password and one-time code). */
export default async function DevLogin({ searchParams }: { searchParams: Promise<{ returnTo?: string; stepUp?: string; error?: string }> }) {
  if (!mockMode()) notFound()
  const { returnTo = '/', stepUp, error } = await searchParams
  return (
    <AuthShell>
      <LoginForm returnTo={returnTo} stepUp={!!stepUp} error={!!error} askOtp={!demoNoOtp()} demo={demoNoOtp()} />
    </AuthShell>
  )
}
