import { TransportError } from '@symbiomed/brace-protocol'
import { BleTransport, type BleDeviceLike, type BleManagerLike } from '../src/brace/ble'
import { BLE_CONFIG, bleConfigured } from '../src/brace/ble-config'

const CONFIG = { ...BLE_CONFIG, serviceUuid: 'svc', rxCharacteristicUuid: 'rx', txCharacteristicUuid: 'tx', writeTimeoutMs: 50, scanTimeoutMs: 50 }
const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

function fakeBle(opts: { mtu: number; failAtChunk?: number; hangAtChunk?: number }) {
  const chunks: Uint8Array[] = []
  let notify: (e: null, c: { value: string }) => void = () => undefined
  const device: BleDeviceLike = {
    id: 'd1',
    mtu: 23,
    discoverAllServicesAndCharacteristics: async () => device,
    requestMTU: async (m) => ({ ...device, mtu: Math.min(m, opts.mtu) }),
    writeCharacteristicWithResponseForService: async (_s, _c, b64) => {
      if (chunks.length === opts.failAtChunk) throw new Error('Device disconnected')
      if (chunks.length === opts.hangAtChunk) return new Promise(() => undefined)
      chunks.push(decode(b64))
    },
    monitorCharacteristicForService: (_s, _c, cb) => ((notify = cb as typeof notify), { remove: () => undefined }),
    cancelConnection: async () => undefined,
  }
  const manager: BleManagerLike = {
    startDeviceScan: (_u, _o, cb) => cb(null, { id: 'd1', name: 'SymbioMed-0042' }),
    stopDeviceScan: () => undefined,
    connectToDevice: async () => device,
  }
  return { manager, chunks, notify: (bytes: Uint8Array) => notify(null, { value: btoa(String.fromCharCode(...bytes)) }) }
}
const frame = Uint8Array.from({ length: 146 }, (_, i) => i)

describe('BleTransport', () => {
  it('stays on the mock brace until the UUIDs are filled in', () => {
    expect(bleConfigured()).toBe(false)
    expect(bleConfigured(CONFIG)).toBe(true)
  })

  it('writes MTU-sized chunks (MTU minus 3) that add up to the frame', async () => {
    for (const [mtu, size] of [[23, 20], [185, 182], [247, 244]] as const) {
      const f = fakeBle({ mtu })
      const t = new BleTransport(f.manager, CONFIG)
      await t.connect()
      await t.write(frame)
      expect(f.chunks.every((c) => c.length <= size)).toBe(true)
      expect(Uint8Array.from(f.chunks.flatMap((c) => [...c]))).toEqual(frame)
    }
  })

  it('ends a transfer that breaks mid-way with the bytes sent, and does not retry', async () => {
    const f = fakeBle({ mtu: 23, failAtChunk: 2 })
    const t = new BleTransport(f.manager, CONFIG)
    await t.connect()
    await expect(t.write(frame)).rejects.toEqual(new TransportError('Device disconnected', 40))
    expect(f.chunks).toHaveLength(2)
  })

  it('times out a write that never completes', async () => {
    const f = fakeBle({ mtu: 23, hangAtChunk: 1 })
    const t = new BleTransport(f.manager, CONFIG)
    await t.connect()
    await expect(t.write(frame)).rejects.toMatchObject({ bytesSent: 20, message: 'write timed out' })
  })

  it('passes notifications on as bytes', async () => {
    const f = fakeBle({ mtu: 23 })
    const t = new BleTransport(f.manager, CONFIG)
    const got: number[] = []
    t.onData((c) => got.push(...c))
    await t.connect()
    f.notify(Uint8Array.from([1, 2, 3]))
    expect(got).toEqual([1, 2, 3])
  })
})
