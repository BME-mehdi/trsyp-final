'use client'
import { signOut, useApi } from '../lib/client'

export function SignOutButton() {
  const { session } = useApi()
  return (
    <button type="button" onClick={() => void signOut(session.csrf)} className="min-h-11 rounded border border-control px-3 py-1">
      Sign out
    </button>
  )
}
