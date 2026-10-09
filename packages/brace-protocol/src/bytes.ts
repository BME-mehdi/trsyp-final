// Little-endian field writer and reader. Every write checks that the value fits: nothing is truncated silently.
export class WireError extends Error {}

export class Writer {
  private buf = new Uint8Array(512)
  private view = new DataView(this.buf.buffer)
  length = 0
  private room(n: number) {
    if (this.length + n > this.buf.length) throw new WireError('frame too large')
  }
  u8(v: number) { this.int(v, 0, 0xff); this.room(1); this.view.setUint8(this.length, v); this.length += 1 }
  u16(v: number) { this.int(v, 0, 0xffff); this.room(2); this.view.setUint16(this.length, v, true); this.length += 2 }
  i16(v: number) { this.int(v, -0x8000, 0x7fff); this.room(2); this.view.setInt16(this.length, v, true); this.length += 2 }
  u32(v: number) { this.int(v, 0, 0xffffffff); this.room(4); this.view.setUint32(this.length, v, true); this.length += 4 }
  bytes(b: Uint8Array) { this.room(b.length); this.buf.set(b, this.length); this.length += b.length }
  /** ASCII text, zero-padded to `size` bytes. */
  ascii(s: string, size: number) {
    if (!/^[\x21-\x7e]*$/.test(s) || s.length > size) throw new WireError(`text does not fit ${size} ASCII bytes`)
    const b = new Uint8Array(size)
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i)
    this.bytes(b)
  }
  uuid(s: string) {
    const hex = s.replace(/-/g, '')
    if (!/^[0-9a-f]{32}$/.test(hex)) throw new WireError('not a lower-case UUID')
    this.bytes(Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16)))
  }
  private int(v: number, min: number, max: number) {
    if (!Number.isInteger(v) || v < min || v > max) throw new WireError(`value ${v} does not fit the field`)
  }
  done() { return this.buf.slice(0, this.length) }
}

export class Reader {
  private view: DataView
  pos = 0
  constructor(private buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  private need(n: number) {
    if (this.pos + n > this.buf.length) throw new WireError('frame too short')
  }
  u8() { this.need(1); return this.view.getUint8(this.pos++) }
  u16() { this.need(2); const v = this.view.getUint16(this.pos, true); this.pos += 2; return v }
  i16() { this.need(2); const v = this.view.getInt16(this.pos, true); this.pos += 2; return v }
  u32() { this.need(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v }
  bytes(n: number) { this.need(n); const b = this.buf.slice(this.pos, this.pos + n); this.pos += n; return b }
  ascii(size: number) {
    const b = this.bytes(size)
    const end = b.indexOf(0) === -1 ? size : b.indexOf(0)
    if (b.slice(end).some((x) => x !== 0)) throw new WireError('text field not zero-padded')
    return String.fromCharCode(...b.slice(0, end))
  }
  uuid() {
    const h = [...this.bytes(16)].map((x) => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
}
