import * as AuthSession from 'expo-auth-session'
import * as LocalAuthentication from 'expo-local-authentication'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { KEYS, read, wipe, write } from './storage'

export const CONFIG = {
  bff: process.env.EXPO_PUBLIC_BFF_URL ?? 'http://localhost:3000',
  issuer: process.env.EXPO_PUBLIC_OIDC_ISSUER ?? 'http://localhost:8180/realms/symbiomed',
  clientId: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID ?? 'symbiomed-mobile',
  mock: process.env.EXPO_PUBLIC_MOCK === '1',
}
export const redirectUri = () => AuthSession.makeRedirectUri({ scheme: 'symbiomed', path: 'auth/callback' })

type Status = 'loading' | 'signed-out' | 'locked' | 'signed-in'
type Ctx = {
  status: Status
  patientId: string | null
  getToken: () => Promise<string | null>
  /** Stores tokens from the sign-in screen (Keycloak code + PKCE, or the mock BFF in mock mode). */
  completeSignIn: (t: { accessToken: string; refreshToken?: string | null; expiresIn?: number | null }) => Promise<void>
  unlock: () => Promise<boolean>
  signOut: () => Promise<void>
}
const AuthCtx = createContext<Ctx | null>(null)

/** patient_id from the access token. Read only to address API calls; the BFF verifies the token. */
export function patientIdOf(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { patient_id?: unknown }
    return typeof payload.patient_id === 'string' ? payload.patient_id : null
  } catch {
    return null
  }
}

export function AuthProvider({ children, biometric, onSignedOut }: { children: ReactNode; biometric: boolean; onSignedOut: () => void }) {
  const [status, setStatus] = useState<Status>('loading')
  const [patientId, setPatientId] = useState<string | null>(null)
  const discovery = AuthSession.useAutoDiscovery(CONFIG.issuer)
  const biometricRef = useRef(biometric)
  biometricRef.current = biometric

  useEffect(() => {
    void read(KEYS.access).then((token) => {
      setPatientId(token ? patientIdOf(token) : null)
      setStatus(!token ? 'signed-out' : biometricRef.current ? 'locked' : 'signed-in')
    })
  }, [])

  // Lock again when the app comes back from the background, if biometric unlock is on.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' && biometricRef.current) setStatus((cur) => (cur === 'signed-in' ? 'locked' : cur))
    })
    return () => sub.remove()
  }, [])

  const signOut = useCallback(async () => {
    await wipe()
    setPatientId(null)
    setStatus('signed-out')
    onSignedOut()
  }, [onSignedOut])

  const getToken = useCallback(async () => {
    const [access, refresh, expiresAt] = await Promise.all([read(KEYS.access), read(KEYS.refresh), read(KEYS.expiresAt)])
    if (!access) return null
    if (!expiresAt || Date.now() < Number(expiresAt) - 30_000 || !refresh || !discovery) return access
    try {
      const r = await AuthSession.refreshAsync({ clientId: CONFIG.clientId, refreshToken: refresh }, discovery)
      await Promise.all([write(KEYS.access, r.accessToken), r.refreshToken ? write(KEYS.refresh, r.refreshToken) : null, write(KEYS.expiresAt, String(Date.now() + (r.expiresIn ?? 300) * 1000))])
      return r.accessToken
    } catch {
      await signOut()
      return null
    }
  }, [discovery, signOut])

  const value = useMemo<Ctx>(() => ({
    status,
    patientId,
    getToken,
    signOut,
    completeSignIn: async ({ accessToken, refreshToken, expiresIn }) => {
      await Promise.all([
        write(KEYS.access, accessToken),
        refreshToken ? write(KEYS.refresh, refreshToken) : null,
        expiresIn ? write(KEYS.expiresAt, String(Date.now() + expiresIn * 1000)) : null,
      ])
      setPatientId(patientIdOf(accessToken))
      setStatus('signed-in')
    },
    unlock: async () => {
      const r = await LocalAuthentication.authenticateAsync({ disableDeviceFallback: false })
      if (r.success) setStatus('signed-in')
      return r.success
    },
  }), [status, patientId, getToken, signOut])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
