import { TransportError, type BraceTransport } from '@symbiomed/brace-protocol'
import type { BleConfig } from './ble-config'

// The parts of react-native-ble-plx this transport uses (its BleManager and Device satisfy them).
type Subscription = { remove(): void }
type BleError = { message: string } | null
export type BleDeviceLike = {
  id: string
  mtu: number
  discoverAllServicesAndCharacteristics(): Promise<BleDeviceLike>
  requestMTU(mtu: number): Promise<BleDeviceLike>
  writeCharacteristicWithResponseForService(service: string, characteristic: string, base64: string): Promise<unknown>
  monitorCharacteristicForService(service: string, characteristic: string, cb: (e: BleError, c: { value: string | null } | null) => void): Subscription
  cancelConnection(): Promise<unknown>
}
export type BleManagerLike = {
  startDeviceScan(uuids: string[] | null, options: object | null, cb: (e: BleError, d: { id: string; name: string | null } | null) => void): unknown
  stopDeviceScan(): unknown
  connectToDevice(id: string, options?: { timeout?: number }): Promise<BleDeviceLike>
}

const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const withTimeout = <T,>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms))])

/**
 * BLE link to the brace. Frames are written in MTU-sized chunks, each with a response; a failed or
 * timed-out chunk ends the transfer with TransportError (bytes sent so far). No silent retry.
 */
export class BleTransport implements BraceTransport {
  readonly kind = 'ble'
  private device: BleDeviceLike | null = null
  private sub: Subscription | null = null
  private listeners = new Set<(c: Uint8Array) => void>()

  constructor(private manager: BleManagerLike, private config: BleConfig) {}

  async connect() {
    const c = this.config
    const found = await withTimeout(
      new Promise<string>((resolve, reject) => {
        this.manager.startDeviceScan([c.serviceUuid], null, (e, d) => {
          if (e) return reject(new Error(e.message))
          if (d?.name?.startsWith(c.deviceNamePrefix)) resolve(d.id)
        })
      }),
      c.scanTimeoutMs,
      'scan',
    ).finally(() => this.manager.stopDeviceScan())
    let d = await this.manager.connectToDevice(found, { timeout: c.connectTimeoutMs })
    d = await d.discoverAllServicesAndCharacteristics()
    d = await d.requestMTU(c.mtu).catch(() => d) // keep the default MTU if the phone refuses
    this.device = d
    this.sub = d.monitorCharacteristicForService(c.serviceUuid, c.txCharacteristicUuid, (_e, ch) => {
      if (ch?.value) {
        const bytes = fromBase64(ch.value)
        this.listeners.forEach((l) => l(bytes))
      }
    })
  }

  async disconnect() {
    this.sub?.remove()
    await this.device?.cancelConnection().catch(() => undefined)
    this.device = null
  }

  onData(l: (c: Uint8Array) => void) {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }

  /** Payload per write: negotiated MTU minus the 3-byte ATT header. */
  chunkSize() {
    return Math.max(20, (this.device?.mtu ?? 23) - 3)
  }

  async write(bytes: Uint8Array) {
    const d = this.device
    if (!d) throw new TransportError('not connected', 0)
    const size = this.chunkSize()
    let sent = 0
    while (sent < bytes.length) {
      const chunk = bytes.slice(sent, sent + size)
      try {
        await withTimeout(d.writeCharacteristicWithResponseForService(this.config.serviceUuid, this.config.rxCharacteristicUuid, toBase64(chunk)), this.config.writeTimeoutMs, 'write')
      } catch (e) {
        throw new TransportError(e instanceof Error ? e.message : 'write failed', sent)
      }
      sent += chunk.length
    }
  }
}
