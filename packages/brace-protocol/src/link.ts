import { validatePlan, type Plan, type SessionSummary } from '@symbiomed/domain'
import { Reader, WireError, Writer } from './bytes'
import { FRAME, FrameReader, frame, parseFrame } from './frames'
import { decodePlan, encodePlan, type PlanRejection } from './plan'
import { decodeSession } from './session'

/** One link to one brace: BLE, USB-serial (Web Serial) or the in-memory mock. Same frames on every link. */
export interface BraceTransport {
  readonly kind: 'mock' | 'ble' | 'serial'
  connect(): Promise<void>
  disconnect(): Promise<void>
  /** Writes every byte or throws TransportError saying how many went out. Never retries on its own. */
  write(bytes: Uint8Array): Promise<void>
  /** Incoming bytes, in whatever chunks the link delivers. Returns an unsubscribe function. */
  onData(listener: (chunk: Uint8Array) => void): () => void
}

export class TransportError extends Error {
  constructor(message: string, readonly bytesSent: number) {
    super(message)
  }
}

export const PLAN_STATUS = ['accepted', 'length', 'magic', 'format', 'crc', 'type', 'range', 'wrong-patient', 'older-version', 'expired'] as const
export const planResultFrame = (status: (typeof PLAN_STATUS)[number], version: number) => {
  const w = new Writer()
  w.u8(PLAN_STATUS.indexOf(status))
  w.u32(version)
  return frame(FRAME.planResult, w.done())
}

export type SendResult =
  | { status: 'refused'; reason: 'not-approved' | 'range' | PlanRejection } // checked in the app: nothing was sent
  | { status: 'accepted'; version: number }
  | { status: 'rejected'; reason: PlanRejection } // the brace checked and refused
  | { status: 'interrupted'; bytesSent: number; total: number } // partial write: not retried
  | { status: 'no-reply' }

export type SyncResult = { uploaded: number; problem: null | 'upload' | 'interrupted' | 'no-reply' | 'corrupt' }

/** Protocol client used by the app and the bench page. */
export class BraceLink {
  private reader = new FrameReader()
  private inbox: Uint8Array[] = []
  private waiting: (() => void) | null = null

  constructor(private t: BraceTransport, private timeoutMs = 5000) {
    t.onData((chunk) => {
      this.inbox.push(...this.reader.push(chunk))
      this.waiting?.()
    })
  }

  private async next(): Promise<Uint8Array | null> {
    if (this.inbox.length) return this.inbox.shift()!
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, this.timeoutMs)
      this.waiting = () => {
        clearTimeout(timer)
        resolve()
      }
    })
    this.waiting = null
    return this.inbox.shift() ?? null
  }

  private async send(bytes: Uint8Array): Promise<TransportError | null> {
    try {
      await this.t.write(bytes)
      return null
    } catch (e) {
      if (e instanceof TransportError) return e
      throw e
    }
  }

  /**
   * Sends an approved, unexpired plan of the signed-in patient, newer than the one on the brace.
   * Anything else is refused here, before a single byte is written; the brace checks it all again.
   */
  async sendPlan(plan: Plan, ctx: { patientId: string; lastVersionOnBrace: number | null; now?: Date }): Promise<SendResult> {
    if (!validatePlan(plan).success) return { status: 'refused', reason: 'not-approved' }
    let bytes: Uint8Array
    try {
      bytes = encodePlan(plan)
    } catch (e) {
      if (e instanceof WireError) return { status: 'refused', reason: 'range' }
      throw e
    }
    const check = decodePlan(bytes, { patientId: ctx.patientId, lastVersion: ctx.lastVersionOnBrace, now: ctx.now ?? new Date() })
    if (!check.ok) return { status: 'refused', reason: check.reason }

    const failed = await this.send(bytes)
    if (failed) return { status: 'interrupted', bytesSent: failed.bytesSent, total: bytes.length }
    const reply = await this.next()
    if (!reply) return { status: 'no-reply' }
    try {
      const f = parseFrame(reply)
      if (f.type !== FRAME.planResult) return { status: 'no-reply' }
      const r = new Reader(f.payload)
      const status = PLAN_STATUS[r.u8()]
      const version = r.u32()
      if (status === 'accepted') return { status: 'accepted', version }
      return status ? { status: 'rejected', reason: status } : { status: 'no-reply' }
    } catch {
      return { status: 'no-reply' }
    }
  }

  /**
   * Fetches the sessions stored on the brace, uploads each one, and only then tells the brace it may
   * delete it. If an upload fails the brace keeps that session: no session is lost.
   */
  async syncSessions(upload: (s: SessionSummary) => Promise<void>): Promise<SyncResult> {
    if (await this.send(frame(FRAME.sessionRequest, new Uint8Array(0)))) return { uploaded: 0, problem: 'interrupted' }
    const sessions: SessionSummary[] = []
    for (;;) {
      const f = await this.next()
      if (!f) return { uploaded: 0, problem: 'no-reply' }
      let parsed
      try {
        parsed = parseFrame(f)
        if (parsed.type === FRAME.sessionsEnd) break
        sessions.push(decodeSession(f))
      } catch {
        return { uploaded: 0, problem: 'corrupt' }
      }
    }
    let uploaded = 0
    for (const s of sessions) {
      try {
        await upload(s)
      } catch {
        return { uploaded, problem: 'upload' }
      }
      const w = new Writer()
      w.uuid(s.sessionId)
      if (await this.send(frame(FRAME.sessionAck, w.done()))) return { uploaded, problem: 'interrupted' }
      uploaded++
    }
    return { uploaded, problem: null }
  }
}
