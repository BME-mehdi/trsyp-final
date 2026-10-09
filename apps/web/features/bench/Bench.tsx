'use client'
import { BraceLink, type SendResult } from '@symbiomed/brace-protocol'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useApi } from '../../lib/client'
import { SerialTransport, type SerialPortLike } from './serial'

type SerialLike = { requestPort(): Promise<SerialPortLike> }

const RESULT: Record<string, string> = {
  accepted: 'The brace accepted plan version {v}.',
  interrupted: 'The cable or port was lost during the transfer ({sent} of {total} bytes). The brace keeps its last valid plan. Nothing was retried.',
  'no-reply': 'The brace did not answer.',
}
function describe(r: SendResult): string {
  if (r.status === 'accepted') return RESULT.accepted!.replace('{v}', String(r.version))
  if (r.status === 'interrupted') return RESULT.interrupted!.replace('{sent}', String(r.bytesSent)).replace('{total}', String(r.total))
  if (r.status === 'no-reply') return RESULT['no-reply']!
  return `${r.status === 'refused' ? 'Not sent: the app refused it' : 'The brace refused it'} (${r.reason}).`
}

/**
 * Bench page (feature flag NEXT_PUBLIC_FEATURE_BENCH=1): USB-serial link to a brace on the bench,
 * between sessions only (USB present means no stimulation). It reads sessions and sends the approved
 * plan with the same frames as BLE. It never starts or controls stimulation.
 */
export function Bench() {
  const { api } = useApi()
  const patients = useQuery({ queryKey: ['patients'], queryFn: () => api.listPatients() })
  // Known only in the browser: decided after hydration so server and client render the same HTML.
  const [serial, setSerial] = useState<SerialLike | null | undefined>(undefined)
  useEffect(() => setSerial((navigator as Navigator & { serial?: SerialLike }).serial ?? null), [])
  const [conn, setConn] = useState<{ t: SerialTransport; link: BraceLink } | null>(null)
  const [patientId, setPatientId] = useState('')
  const [log, setLog] = useState<string[]>([])
  const note = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${line}`, ...l])

  const connect = async () => {
    try {
      const t = new SerialTransport(await serial!.requestPort())
      await t.connect()
      setConn({ t, link: new BraceLink(t) })
      note('Connected.')
    } catch {
      note('No port selected or the port could not be opened.')
    }
  }
  const disconnect = async () => {
    await conn?.t.disconnect()
    setConn(null)
    note('Disconnected.')
  }
  const sendPlan = async () => {
    const { plan } = await api.getPlan(patientId)
    if (!plan) return note('This patient has no approved plan.')
    note(describe(await conn!.link.sendPlan(plan, { patientId, lastVersionOnBrace: null })))
  }
  const readSessions = async () => {
    const r = await conn!.link.syncSessions(async (s) => void (await api.postSession(s.patientId, s)))
    note(`Sessions uploaded: ${r.uploaded}.${r.problem ? ` Stopped: ${r.problem}. The brace keeps the sessions not uploaded.` : ''}`)
  }

  const button = 'min-h-11 rounded px-4 font-semibold disabled:opacity-60'
  return (
    <section aria-labelledby="bench" className="max-w-3xl">
      <h1 id="bench" className="text-2xl font-semibold">Bench: USB-serial link</h1>
      <p className="mt-2">For the bench and the demonstration fallback (decision D-08). Connect the brace by USB between sessions; it cannot stimulate while USB is connected.</p>
      {serial === null && <p role="alert" className="mt-4">This browser has no Web Serial support. Use Chrome or Edge on a computer.</p>}
      {serial && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void connect()} disabled={conn !== null} className={`${button} bg-accent text-on-accent`}>Connect brace</button>
            <button type="button" onClick={() => void disconnect()} disabled={conn === null} className={`${button} border border-control`}>Disconnect</button>
          </div>
          <label className="block">
            Patient
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="ml-2 min-h-11 rounded border border-control px-2">
              <option value="">Choose</option>
              {patients.data?.patients.map((p) => <option key={p.patientId} value={p.patientId}>{p.label}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void readSessions()} disabled={!conn} className={`${button} border border-control`}>Read sessions from the brace</button>
            <button type="button" onClick={() => void sendPlan()} disabled={!conn || !patientId} className={`${button} bg-accent text-on-accent`}>Send approved plan</button>
          </div>
        </div>
      )}
      <ul role="log" aria-label="Bench log" className="mt-4 space-y-1">{log.map((l) => <li key={l}>{l}</li>)}</ul>
    </section>
  )
}
