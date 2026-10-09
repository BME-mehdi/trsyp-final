'use client'
import { signOut, useApi } from '../lib/client'

export function SignOutButton() {
  const { session } = useApi()
  return (
    <button type="button" onClick={() => void signOut(session.csrf)} className="min-h-11 rounded-lg border border-control bg-page px-3 py-1 font-semibold hover:border-accent hover:text-accent">
      Sign out
    </button>
  )
}
