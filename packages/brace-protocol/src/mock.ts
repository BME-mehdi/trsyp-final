import type { SessionSummary } from '@symbiomed/domain'
import { Reader, Writer } from './bytes'
import { FRAME, FrameReader, frame, parseFrame } from './frames'
import { TransportError, planResultFrame, type BraceTransport } from './link'
import { decodePlan, type WirePlan } from './plan'
import { encodeSession } from './session'

export type Failure = {
  /** The link drops after this many bytes of the next write (a partial transfer). */
  disconnectAfterBytes?: number
  /** One byte of the next write is flipped on the way (bit error). */
  corruptByteAt?: number
  /** The brace never answers. */
  silent?: boolean
}

/**
 * In-memory link to a simulated brace that applies the same checks as the firmware: CRC, limits,
 * patient, version and expiry; it keeps its last valid plan otherwise. Default transport for demos and tests.
 */
export class MockTransport implements BraceTransport {
  readonly kind = 'mock'
  connected = false
  writes = 0
  bytesReceived = 0
  brace: { patientId: string; plan: WirePlan | null; sessions: SessionSummary[] }
  private listeners = new Set<(c: Uint8Array) => void>()
  private reader = new FrameReader()

  constructor(opts: { patientId: string; plan?: WirePlan | null; sessions?: SessionSummary[]; failure?: Failure; now?: () => Date }, private now = opts.now ?? (() => new Date())) {
    this.brace = { patientId: opts.patientId, plan: opts.plan ?? null, sessions: [...(opts.sessions ?? [])] }
    this.failure = opts.failure ?? {}
  }
  failure: Failure

  async connect() {
    this.connected = true
    this.reader = new FrameReader() // the firmware drops a partial frame when a link (re)connects
  }
  async disconnect() {
    this.connected = false
  }
  onData(l: (c: Uint8Array) => void) {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }

  async write(bytes: Uint8Array) {
    if (!this.connected) throw new TransportError('not connected', 0)
    this.writes++
    let data = bytes
    const { corruptByteAt, disconnectAfterBytes } = this.failure
    if (corruptByteAt !== undefined && corruptByteAt < data.length) {
      data = data.slice()
      data[corruptByteAt]! ^= 0xff
      this.failure = { ...this.failure, corruptByteAt: undefined }
    }
    if (disconnectAfterBytes !== undefined && disconnectAfterBytes < data.length) {
      this.receive(data.subarray(0, disconnectAfterBytes))
      this.connected = false
      this.failure = { ...this.failure, disconnectAfterBytes: undefined }
      throw new TransportError('link lost during the transfer', disconnectAfterBytes)
    }
    this.receive(data)
  }

  private receive(data: Uint8Array) {
    this.bytesReceived += data.length
    for (const f of this.reader.push(data)) this.handle(f)
  }

  private reply(bytes: Uint8Array) {
    if (this.failure.silent) return
    for (let i = 0; i < bytes.length; i += 20) {
      const chunk = bytes.slice(i, i + 20) // like BLE notifications: the app must reassemble
      queueMicrotask(() => this.listeners.forEach((l) => l(chunk)))
    }
  }

  private handle(bytes: Uint8Array) {
    let type: number
    try {
      type = parseFrame(bytes).type
    } catch {
      type = FRAME.plan // let the plan check report the integrity error
    }
    if (type === FRAME.plan) {
      const r = decodePlan(bytes, { patientId: this.brace.patientId, lastVersion: this.brace.plan?.version ?? null, now: this.now() })
      if (r.ok) this.brace.plan = r.plan
      this.reply(planResultFrame(r.ok ? 'accepted' : r.reason, this.brace.plan?.version ?? 0))
    } else if (type === FRAME.sessionRequest) {
      for (const s of this.brace.sessions) this.reply(encodeSession(s))
      const w = new Writer()
      w.u16(this.brace.sessions.length)
      this.reply(frame(FRAME.sessionsEnd, w.done()))
    } else if (type === FRAME.sessionAck) {
      const id = new Reader(parseFrame(bytes).payload).uuid()
      this.brace.sessions = this.brace.sessions.filter((s) => s.sessionId !== id)
    }
  }
}
