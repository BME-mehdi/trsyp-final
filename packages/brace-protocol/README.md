# @symbiomed/brace-protocol

Plan ↔ bytes, CRC-32, session-summary decoding, and the link to the brace. Pure TypeScript, no platform code. Format: docs/BRACE_PROTOCOL.md.

- `encodePlan(plan)`, `decodePlan(bytes, { patientId, lastVersion, now })`: integrity (length, magic, format, CRC), limits, patient, version, expiry. Reserved field for the future HMAC.
- `encodeSession`, `decodeSession` (checked against the domain schema), `FrameReader` (reassembles chunked streams).
- `BraceTransport` interface; `BraceLink` (app-side checks before any byte is written, session sync that deletes on the brace only after upload); `MockTransport` (simulated brace with failure injection: disconnect mid-transfer, corruption, silence).
- Implementations elsewhere: `BleTransport` (apps/mobile, react-native-ble-plx), `SerialTransport` (apps/web bench, Web Serial).

A partial transfer is never retried silently: the caller gets `interrupted` with the bytes sent.
Tests: `pnpm --filter @symbiomed/brace-protocol test` (golden frames, round trips, every-byte corruption, failure injection).
