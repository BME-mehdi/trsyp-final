import { createApiClient, type ApiClient } from '@symbiomed/api-client'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { CONFIG, useAuth } from './auth'
import { DEMO, demoApi } from './demo'

const ApiCtx = createContext<ApiClient | null>(null)

/** The typed BFF client with the patient's bearer token. Tests pass a fake client instead. */
export function ApiProvider({ children, client }: { children: ReactNode; client?: ApiClient }) {
  const { getToken } = useAuth()
  const api = useMemo(() => client ?? (DEMO ? demoApi : createApiClient({ baseUrl: CONFIG.bff, getToken })), [client, getToken])
  return <ApiCtx.Provider value={api}>{children}</ApiCtx.Provider>
}

export function useApi() {
  const c = useContext(ApiCtx)
  if (!c) throw new Error('useApi outside ApiProvider')
  return c
}
