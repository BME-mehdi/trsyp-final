import { BraceLink, MockTransport, type BraceTransport, type SendResult } from '@symbiomed/brace-protocol'
import type { MessageKey } from '@symbiomed/i18n'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApi } from '../api'
import { useAuth } from '../auth'
import { useSettings } from '../settings'
import { BLE_CONFIG, bleConfigured } from './ble-config'

export type LinkState = 'disconnected' | 'searching' | 'connected' | 'syncing' | 'error'
export type BraceStatus = { link: LinkState; lastSyncAt: string | null; planVersionOnBrace: number | null; pendingUploads: number; message: string | null }
type Ctx = BraceStatus & { kind: BraceTransport['kind'] | null; sync: () => Promise<void>; update: (patch: Partial<BraceStatus>) => void }

const initial: BraceStatus = { link: 'disconnected', lastSyncAt: null, planVersionOnBrace: null, pendingUploads: 0, message: null }
const BraceCtx = createContext<Ctx | null>(null)

/** What the patient reads after a plan transfer. App-side refusals are not reported as the brace's. */
export const PLAN_MESSAGE = (r: SendResult): MessageKey => {
  if (r.status === 'accepted') return 'sync.planSent'
  if (r.status === 'interrupted') return 'sync.interrupted'
  if (r.status === 'no-reply') return 'sync.failed'
  if (r.status === 'refused') return r.reason === 'expired' ? 'plan.expiredHelp' : r.reason === 'wrong-patient' ? 'sync.rejected.wrongPatient' : r.reason === 'older-version' ? 'sync.rejected.olderVersion' : 'sync.failed'
  return r.reason === 'expired' ? 'sync.rejected.expired' : r.reason === 'wrong-patient' ? 'sync.rejected.wrongPatient' : r.reason === 'older-version' ? 'sync.rejected.olderVersion' : 'sync.rejected.checksum'
}

async function defaultTransport(patientId: string): Promise<BraceTransport> {
  if (!bleConfigured()) return new MockTransport({ patientId }) // demo brace until the UUIDs are filled in
  const [{ BleManager }, { BleTransport }] = await Promise.all([import('react-native-ble-plx'), import('./ble')])
  return new BleTransport(new BleManager() as never, BLE_CONFIG)
}

/**
 * Brace link status and the one action the app has: sync. Sync uploads the sessions stored on the
 * brace, then sends the current approved plan. It never starts or controls stimulation.
 */
export function BraceProvider({ children, value, transport }: { children: ReactNode; value?: Partial<BraceStatus>; transport?: BraceTransport }) {
  const [s, setS] = useState<BraceStatus>({ ...initial, ...value })
  const { t } = useSettings()
  const api = useApi()
  const { patientId } = useAuth()
  const linkRef = useRef<{ t: BraceTransport; link: BraceLink } | null>(null)
  const versionRef = useRef(s.planVersionOnBrace)
  const update = useCallback((patch: Partial<BraceStatus>) => setS((cur) => ({ ...cur, ...patch })), [])

  const sync = useCallback(async () => {
    if (!patientId) return
    update({ link: 'searching', message: null })
    try {
      if (!linkRef.current) {
        const tr = transport ?? (await defaultTransport(patientId))
        linkRef.current = { t: tr, link: new BraceLink(tr) }
      }
      const { t: tr, link } = linkRef.current
      await tr.connect()
      update({ link: 'syncing' })
      const sessions = await link.syncSessions(async (session) => void (await api.postSession(patientId, session)))
      const { plan } = await api.getPlan(patientId)
      const messages: string[] = []
      if (sessions.uploaded > 0) messages.push(t('sync.sessionsUploaded', { count: sessions.uploaded }))
      if (sessions.problem) messages.push(t(sessions.problem === 'interrupted' ? 'sync.interrupted' : 'sync.failed'))
      if (!plan) messages.push(t('plan.noneHelp'))
      else {
        const r = await link.sendPlan(plan, { patientId, lastVersionOnBrace: versionRef.current })
        if (r.status === 'accepted') versionRef.current = r.version
        messages.push(t(PLAN_MESSAGE(r), { version: plan.version }))
      }
      await tr.disconnect()
      update({ link: 'disconnected', lastSyncAt: new Date().toISOString(), planVersionOnBrace: versionRef.current, message: messages.join(' ') })
    } catch {
      update({ link: 'error', message: t('sync.failed') })
    }
  }, [api, patientId, t, transport, update])

  const ctx = useMemo<Ctx>(() => ({ ...s, kind: transport?.kind ?? (bleConfigured() ? 'ble' : 'mock'), sync, update }), [s, sync, transport, update])
  return <BraceCtx.Provider value={ctx}>{children}</BraceCtx.Provider>
}

export function useBrace() {
  const c = useContext(BraceCtx)
  if (!c) throw new Error('useBrace outside BraceProvider')
  return c
}
