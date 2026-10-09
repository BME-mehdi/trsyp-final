/*
 * ============================ FILL IN: brace GATT layout ============================
 * UUIDs and names from the firmware team. While serviceUuid is empty the app uses the mock
 * brace (and says so on the Brace screen). Same frames as USB-serial: docs/BRACE_PROTOCOL.md.
 * TODO(firmware): service and characteristic UUIDs, advertised name prefix, MTU the ESP32 accepts.
 * ===================================================================================
 */
export const BLE_CONFIG = {
  serviceUuid: '',
  /** app -> brace, write with response */
  rxCharacteristicUuid: '',
  /** brace -> app, notify */
  txCharacteristicUuid: '',
  deviceNamePrefix: 'SymbioMed',
  /** Requested ATT MTU; the payload per write is the negotiated MTU minus 3. */
  mtu: 247,
  scanTimeoutMs: 15_000,
  connectTimeoutMs: 10_000,
  writeTimeoutMs: 5_000,
}
export type BleConfig = typeof BLE_CONFIG
export const bleConfigured = (c: BleConfig = BLE_CONFIG) => c.serviceUuid !== '' && c.rxCharacteristicUuid !== '' && c.txCharacteristicUuid !== ''
