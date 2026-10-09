import { TransportError, type BraceTransport } from '@symbiomed/brace-protocol'

/** The parts of the Web Serial SerialPort used here (Chrome and Edge only; the DOM lib does not declare them yet). */
export type SerialPortLike = {
  open(o: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}

const CHUNK = 64 // bytes per write, so a broken transfer reports how far it got

/**
 * USB-serial link to the brace (bench page, between sessions only: USB present means no stimulation).
 * Same frames as BLE. A failed write ends the transfer with TransportError; nothing is retried.
 */
export class SerialTransport implements BraceTransport {
  readonly kind = 'serial'
  private listeners = new Set<(c: Uint8Array) => void>()
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null

  constructor(private port: SerialPortLike, private baudRate = 115_200) {}

  async connect() {
    await this.port.open({ baudRate: this.baudRate })
    this.reader = this.port.readable?.getReader() ?? null
    void this.pump()
  }

  private async pump() {
    for (;;) {
      const r = await this.reader?.read().catch(() => null)
      if (!r || r.done) return
      this.listeners.forEach((l) => l(r.value))
    }
  }

  async disconnect() {
    await this.reader?.cancel().catch(() => undefined)
    this.reader = null
    await this.port.close().catch(() => undefined)
  }

  onData(l: (c: Uint8Array) => void) {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }

  async write(bytes: Uint8Array) {
    const writer = this.port.writable?.getWriter()
    if (!writer) throw new TransportError('not connected', 0)
    let sent = 0
    try {
      while (sent < bytes.length) {
        const chunk = bytes.slice(sent, sent + CHUNK)
        await writer.write(chunk)
        sent += chunk.length
      }
    } catch (e) {
      throw new TransportError(e instanceof Error ? e.message : 'write failed', sent)
    } finally {
      writer.releaseLock()
    }
  }
}
