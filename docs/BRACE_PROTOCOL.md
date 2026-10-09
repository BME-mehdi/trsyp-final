# Brace link wire format (version 1)

The same frames travel over BLE (chunked writes to one characteristic, notifications from another) and USB-serial (byte stream). Source of truth: `packages/brace-protocol`; golden frames are checked in its tests (`src/codec.test.ts`) and in `src/golden.ts`. All integers are little-endian.

## Frame
| Offset | Size | Field |
|---|---|---|
| 0 | 4 | Magic `53 4D 42 50` ("SMBP") |
| 4 | 1 | Format version (1) |
| 5 | 1 | Frame type |
| 6 | 2 | Payload length N |
| 8 | N | Payload |
| 8+N | 4 | CRC-32 (IEEE 802.3, as zlib) of bytes 0 … 8+N−1 |

Frame types: `01` plan (app → brace), `02` session (brace → app), `03` session request (app → brace, empty), `04` plan result (brace → app), `05` session ack (app → brace: session uploaded, the brace may delete it), `06` sessions end (brace → app, u16 count).
A receiver drops a partial frame when the link (re)connects. A frame that fails any check is discarded; for a plan, the brace answers with a plan result and keeps its last valid plan.

## Plan payload (134 bytes, frame 146 bytes)
| Offset | Size | Field | Encoding |
|---|---|---|---|
| 0 | 64 | patientId | ASCII, zero-padded (opaque id) |
| 64 | 16 | planId | UUID bytes |
| 80 | 4 | version | u32, strictly increasing |
| 84 | 4 | issuedAt | u32 Unix seconds |
| 88 | 4 | expiresAt | u32 Unix seconds (12–168 h after issuedAt) |
| 92 | 2 | pulseWidthUs | u16, 150–400 |
| 94 | 1 | ceilingMa | u8, 10–50 |
| 95 | 2 | floorFraction | u16 per mille, 400–1000 |
| 97 | 1 | offS | u8, one of 30, 45, 60, 90 |
| 98 | 1 | contractions | u8, one of 10, 15, 20 |
| 99 | 1 | aTargetPctMvc | u8 (30 until the range is confirmed) |
| 100 | 2 | referenceMvc | u16 µV |
| 102 | 32 | reserved | zeros; TODO: HMAC-SHA256 with a per-brace key (decision D-11) |

Checks, in order (brace and app): length, magic, format, CRC, field ranges, patient id, version greater than the stored one, not expired. Values that do not fit a field exactly are refused when encoding, never rounded.

## Plan result payload (5 bytes)
u8 status: 0 accepted, 1 length, 2 magic, 3 format, 4 crc, 5 type, 6 range, 7 wrong-patient, 8 older-version, 9 expired; then u32 version now stored on the brace.

## Session payload (69 + 8 × count bytes)
sessionId (16, UUID), patientId (64, ASCII), planId (16), planVersion (u32), firmwareVersion (16, ASCII), startedAt (u32 s), endedAt (u32 s), mode (u8), flags (u8, bit 0 degraded), contractionsDone (u8), peakDeliveredMa (u16, 0.1 mA), meanDeliveredMa (u16, 0.1 mA), fatigueMdfDropPct (i16, 0.1 %, `0x7FFF` = none), flexionMaxDeg (i16, 0.1°), stop cause (u8: 0 none, 1 stop-button, 2 usb, 3 battery, 4 watchdog, 5 sensor-fault, 6 lead-off, 7 current-error, 8 over-current), count (u8 ≤ 20), then per contraction: index (u8), aV (u16, 0.1 %), commandedMa (u16, 0.1 mA), peakMa (u16, 0.1 mA), Model A label (u8: 0 under, 1 on-target, 2 fatigued, 3 guarding).
Comfort and pain are not on the wire: the patient enters them in the app.
