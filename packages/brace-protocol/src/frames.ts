import { WireError, Reader, Writer } from './bytes'
import { crc32 } from './crc32'

/**
 * Frame = header (8 bytes) + payload + CRC-32 (4 bytes, over header and payload), little-endian.
 * Header: magic "SMBP", format version, frame type, payload length (u16).
 * The same frames travel over BLE and USB-serial. Layout: docs/BRACE_PROTOCOL.md.
 */
export const MAGIC = [0x53, 0x4d, 0x42, 0x50] as const
export const FORMAT_VERSION = 1
export const HEADER = 8
export const CRC_SIZE = 4
export const FRAME = {
  plan: 0x01, // app -> brace
  session: 0x02, // brace -> app
  sessionRequest: 0x03, // app -> brace
  planResult: 0x04, // brace -> app
  sessionAck: 0x05, // app -> brace: uploaded, the brace may delete it
  sessionsEnd: 0x06, // brace -> app
} as const
export type FrameType = (typeof FRAME)[keyof typeof FRAME]

export function frame(type: FrameType, payload: Uint8Array): Uint8Array {
  const w = new Writer()
  w.bytes(Uint8Array.from(MAGIC))
  w.u8(FORMAT_VERSION)
  w.u8(type)
  w.u16(payload.length)
  w.bytes(payload)
  w.u32(crc32(w.done()))
  return w.done()
}

export type ParsedFrame = { type: number; payload: Uint8Array }

/** Checks length, magic, format version and CRC. Throws WireError with the first problem found. */
export function parseFrame(bytes: Uint8Array): ParsedFrame {
  if (bytes.length < HEADER + CRC_SIZE) throw new WireError('length')
  const r = new Reader(bytes)
  if (!MAGIC.every((m) => r.u8() === m)) throw new WireError('magic')
  if (r.u8() !== FORMAT_VERSION) throw new WireError('format')
  const type = r.u8()
  const len = r.u16()
  if (bytes.length !== HEADER + len + CRC_SIZE) throw new WireError('length')
  const body = bytes.subarray(0, HEADER + len)
  const crc = new DataView(bytes.buffer, bytes.byteOffset + HEADER + len, 4).getUint32(0, true)
  if (crc32(body) !== crc) throw new WireError('crc')
  return { type, payload: bytes.slice(HEADER, HEADER + len) }
}

/**
 * Reassembles frames from a byte stream cut into any chunks (BLE notifications, serial reads).
 * Bytes before a magic are skipped, so the stream recovers after noise.
 */
export class FrameReader {
  private buf = new Uint8Array(0)
  push(chunk: Uint8Array): Uint8Array[] {
    const merged = new Uint8Array(this.buf.length + chunk.length)
    merged.set(this.buf)
    merged.set(chunk, this.buf.length)
    this.buf = merged
    const out: Uint8Array[] = []
    for (;;) {
      const start = this.buf.findIndex((_, i) => MAGIC.every((m, j) => this.buf[i + j] === m))
      if (start === -1) {
        this.buf = this.buf.slice(Math.max(0, this.buf.length - (MAGIC.length - 1)))
        return out
      }
      this.buf = this.buf.slice(start)
      if (this.buf.length < HEADER) return out
      const total = HEADER + (this.buf[6]! | (this.buf[7]! << 8)) + CRC_SIZE
      if (this.buf.length < total) return out
      out.push(this.buf.slice(0, total))
      this.buf = this.buf.slice(total)
    }
  }
}
