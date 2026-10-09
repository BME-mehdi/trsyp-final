'use client'
import { createApiClient, type ApiClient } from '@symbiomed/api-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type WebSession = { csrf: string; practitionerId: string; idleTimeoutS: number }
const Ctx = createContext<{ api: ApiClient; session: WebSession } | null>(null)

export function useApi() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApi outside Providers')
  return c
}

export async function signOut(csrf: string, reason: 'idle' | 'signed-out' = 'signed-out') {
  const res = await fetch(`/api/auth/logout?reason=${reason}`, { method: 'POST', headers: { 'x-csrf-token': csrf } }).catch(() => null)
  const body = (await res?.json().catch(() => null)) as { redirect?: string } | null
  window.location.assign(body?.redirect ?? `/signin?reason=${reason}`)
}

/** Signs out after the idle timeout (the server enforces it too). Any key, click or scroll counts as activity. */
function IdleTimer({ session }: { session: WebSession }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void signOut(session.csrf, 'idle'), session.idleTimeoutS * 1000)
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [session])
  return null
}

export function Providers({ session, children }: { session: WebSession; children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }))
  const [api] = useState(() => createApiClient({ baseUrl: '', csrfToken: session.csrf }))
  return (
    <QueryClientProvider client={queryClient}>
      <Ctx.Provider value={{ api, session }}>
        <IdleTimer session={session} />
        {children}
      </Ctx.Provider>
    </QueryClientProvider>
  )
}
