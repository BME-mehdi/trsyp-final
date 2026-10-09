import { BraceLink, GOLDEN_PLAN, MockTransport, TransportError, toWirePlan } from '@symbiomed/brace-protocol'
import { describe, expect, it } from 'vitest'
import { SerialTransport, type SerialPortLike } from './serial'

const NOW = new Date('2026-10-09T12:00:00Z')

/** A serial port whose other end is the simulated brace inside MockTransport: same frames as BLE. */
async function cable(opts: { breakAfterWrites?: number } = {}) {
  const brace = new MockTransport({ patientId: GOLDEN_PLAN.patientId, plan: toWirePlan({ ...GOLDEN_PLAN, version: 11 }), now: () => NOW })
  await brace.connect()
  let toApp!: ReadableStreamDefaultController<Uint8Array>
  let writes = 0
  const port: SerialPortLike = {
    open: async () => undefined,
    close: async () => undefined,
    getInfo: () => ({}),
    readable: new ReadableStream({ start: (c) => void (toApp = c) }),
    writable: new WritableStream({
      write: async (chunk) => {
        if (opts.breakAfterWrites !== undefined && writes++ >= opts.breakAfterWrites) throw new Error('The device has been lost.')
        await brace.write(chunk)
      },
    }),
  }
  brace.onData((c) => toApp.enqueue(c))
  const serial = new SerialTransport(port)
  await serial.connect()
  return { brace, serial, link: new BraceLink(serial, 200) }
}

describe('SerialTransport (Web Serial, bench)', () => {
  it('sends a plan over the same wire format and reads the brace answer', async () => {
    const { brace, link } = await cable()
    expect(await link.sendPlan(GOLDEN_PLAN, { patientId: GOLDEN_PLAN.patientId, lastVersionOnBrace: null, now: NOW })).toEqual({ status: 'accepted', version: 12 })
    expect(brace.brace.plan?.version).toBe(12)
  })

  it('reports a cable pulled mid-transfer with the bytes sent, and the brace keeps its plan', async () => {
    const { brace, link, serial } = await cable({ breakAfterWrites: 1 })
    expect(await link.sendPlan(GOLDEN_PLAN, { patientId: GOLDEN_PLAN.patientId, lastVersionOnBrace: null, now: NOW })).toEqual({ status: 'interrupted', bytesSent: 64, total: 146 })
    expect(brace.brace.plan?.version).toBe(11)
    await expect(serial.write(new Uint8Array(1))).rejects.toBeInstanceOf(TransportError)
  })
})
