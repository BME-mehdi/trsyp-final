# Prompt: ESP32 firmware for the SymbioMed brace link (BLE + USB-serial)

Copy everything below the line into Claude Sonnet, together with the existing firmware sources (or tell it where they are). It is self-contained: every byte the app expects is specified here. Source of truth on the app side: `packages/brace-protocol` and `docs/BRACE_PROTOCOL.md` in https://github.com/BME-mehdi/trsyp-final.

---

You are an embedded engineer adding the **phone/bench link** to the existing ESP32 firmware of the SymbioMed knee brace, a research prototype that delivers NMES into a dummy load only. Write production-quality C++ for the Arduino-ESP32 core, built with PlatformIO, using **NimBLE-Arduino 2.x** for BLE. Work in small steps and show the code for each file in full.

## Hard rules (do not break these)
1. **The link never controls stimulation.** It may only: receive and store an approved plan, report stored session summaries, and delete a summary after the app acknowledges it. Do not add any command that starts, stops, or changes current, and do not call stimulation code from the link.
2. **The real-time core is untouchable.** Stimulation, the 100 ms supervision loop and the safety checks run on **core 0**. All link code (BLE callbacks, USB-serial, parsing, flash writes) runs on **core 1**. Never block core 0; never take a lock that core 0 waits on for more than a few microseconds.
3. **A new plan takes effect only at the next session start.** If a plan arrives during a session, verify and store it, but the running session keeps the plan it started with.
4. **Keep the last valid plan.** A frame that fails any check changes nothing; the brace answers with the reason.
5. **No data loss.** A session summary stays in flash until the app sends an acknowledgement for that exact session id. Power can be cut at any moment, including during flash writes.
6. **Do not guess unknowns.** Where this prompt says OPEN, write a `// OPEN:` comment, pick nothing silently, and list it in your final report.
7. Do not write the words "safe", "secure", "certified" or "validated" in comments, logs or docs (project wording rule; firmware identifiers such as `SAFE_STOP` are fine).

## Transport
**BLE (GATT server):**
- Advertise a device name starting with `SymbioMed` (for example `SymbioMed-` + last 4 hex digits of the MAC) and the service UUID below.
- One primary service with two characteristics:
  - **RX** (app → brace): `WRITE` (with response). The app writes a frame in chunks of at most `MTU − 3` bytes, waiting for each write response. Chunks are raw bytes; frame boundaries are not aligned to chunks.
  - **TX** (brace → app): `NOTIFY`. Send every reply as notifications of at most `MTU − 3` bytes (use the negotiated MTU of the connection; the app requests 247). Do not assume the app reads anything else.
- UUIDs: generate three random v4 UUIDs (service, RX, TX) and put them in one header `link_config.h`. Report them at the end: the app team pastes them into `apps/mobile/src/brace/ble-config.ts` (`serviceUuid`, `rxCharacteristicUuid`, `txCharacteristicUuid`).
- Pairing/bonding and link encryption: OPEN (not required for the MVP; leave a hook).
- One connection at a time.

**USB-serial (bench fallback, decision D-08):**
- Same frames, as a byte stream on the USB CDC/UART at **115 200 baud**, 8N1. The web bench page writes in 64-byte chunks and reads replies from the same port.
- USB present means no stimulation (hardware lockout already exists): the link only works between sessions anyway.

**Both:** feed received bytes into one **frame reassembler** (below). When a link connects or reconnects, **discard any partial frame** in the buffer. Also discard a partial frame after 1 s without new bytes.

## Frame format (version 1, all integers little-endian)
| Offset | Size | Field |
|---|---|---|
| 0 | 4 | Magic `53 4D 42 50` ("SMBP") |
| 4 | 1 | Format version = `01` |
| 5 | 1 | Frame type |
| 6 | 2 | Payload length N (u16) |
| 8 | N | Payload |
| 8+N | 4 | CRC-32 of bytes `0 … 8+N−1` |

CRC-32 = IEEE 802.3, reflected, polynomial `0xEDB88320`, init `0xFFFFFFFF`, final XOR `0xFFFFFFFF` (same as zlib `crc32`). Check value: CRC of ASCII `"123456789"` = `0xCBF43926`.

**Reassembler:** append bytes to a buffer (max 512 bytes; on overflow, drop everything before the next magic); skip bytes until the 4-byte magic; once 8 bytes are present read N; once `8 + N + 4` bytes are present, cut one frame and process it; repeat.

Frame types:
| Type | Direction | Payload |
|---|---|---|
| `01` PLAN | app → brace | 134 bytes, below |
| `02` SESSION | brace → app | 137 + 8 × count bytes, below |
| `03` SESSION_REQUEST | app → brace | empty (N = 0) |
| `04` PLAN_RESULT | brace → app | 5 bytes: u8 status, u32 plan version now stored on the brace (0 if none) |
| `05` SESSION_ACK | app → brace | 16 bytes: session id (UUID bytes) |
| `06` SESSIONS_END | brace → app | 2 bytes: u16 number of sessions sent |

## PLAN payload (134 bytes; frame 146 bytes)
| Offset | Size | Field | Encoding and allowed values |
|---|---|---|---|
| 0 | 64 | patientId | ASCII `[A-Za-z0-9.-]`, 1–64 chars, zero-padded; bytes after the first zero must all be zero |
| 64 | 16 | planId | UUID bytes |
| 80 | 4 | version | u32 ≥ 1 |
| 84 | 4 | issuedAt | u32 Unix seconds |
| 88 | 4 | expiresAt | u32 Unix seconds; `expiresAt − issuedAt` between 43 200 and 604 800 (12–168 h) |
| 92 | 2 | pulseWidthUs | u16, 150–400 |
| 94 | 1 | ceilingMa | u8, 10–50 |
| 95 | 2 | floorFraction | u16 per mille, 400–1000 (floor current = ceiling × value / 1000) |
| 97 | 1 | offS | u8, one of 30, 45, 60, 90 |
| 98 | 1 | contractions | u8, one of 10, 15, 20 |
| 99 | 1 | aTargetPctMvc | u8, exactly 30 for now (range OPEN with the clinical adviser) |
| 100 | 2 | referenceMvc | u16 µV, > 0 |
| 102 | 32 | reserved | must be all zero (future HMAC-SHA256 with a per-brace key, decision D-11) |

### Checks, in this exact order, first failure wins
| Status code | Name | Condition |
|---|---|---|
| 1 | length | total frame shorter than 12 bytes, or length ≠ 8 + N + 4, or plan payload ≠ 134 bytes |
| 2 | magic | magic wrong |
| 3 | format | format version ≠ 1 |
| 4 | crc | CRC mismatch |
| 5 | type | frame type is not PLAN (only when a PLAN result is expected) |
| 6 | range | any field outside the table above, including a non-zero reserved byte |
| 7 | wrong-patient | patientId ≠ the patient this brace is assigned to (stored at the clinic) |
| 8 | older-version | a plan is stored and `version ≤ stored version` |
| 9 | expired | `now ≥ expiresAt` |
| 0 | accepted | everything passed: store the plan atomically |

Reply to every frame that fails integrity (codes 1–4) with a PLAN_RESULT carrying that code. Reply to every PLAN frame with a PLAN_RESULT. **Time source for `now`:** the firmware's existing sanity-checked clock (spec D-12). If the clock is invalid, reply `expired` and keep the plan unchanged. How the clock is set (clinic, phone, RTC) is OPEN: do not add a time-setting frame.

Also check at **session start** (core 0 reads the stored plan): refuse to start when there is no plan or `now ≥ expiresAt`, as the spec requires. The plan does not carry fixed parameters: 50 Hz, ramps 3 s / 15 s / 2 s and the usage limits stay in firmware.

## Plan storage (power-cut tolerant)
- Two slots in NVS (or two flash sectors): write the new plan with its CRC into the inactive slot, read it back, then flip a small "active slot" record. On boot pick the active slot only if its CRC matches; otherwise the other slot; otherwise no plan.
- Hand the plan to core 0 through a double buffer or a short critical section, never by sharing a struct that core 1 is writing.

## SESSION payload (137 + 8 × count bytes)
Build one from each stored session summary when the app sends SESSION_REQUEST; send all stored sessions, oldest first, then SESSIONS_END with the count.
| Offset | Size | Field | Encoding |
|---|---|---|---|
| 0 | 16 | sessionId | UUID bytes (generate a v4 UUID at session start; store it) |
| 16 | 64 | patientId | ASCII, zero-padded |
| 80 | 16 | planId | UUID bytes of the plan the session ran on |
| 96 | 4 | planVersion | u32 |
| 100 | 16 | firmwareVersion | ASCII `[A-Za-z0-9_.+-]`, zero-padded (for example `1.4.0`) |
| 116 | 4 | startedAt | u32 Unix seconds |
| 120 | 4 | endedAt | u32 Unix seconds, ≥ startedAt |
| 124 | 1 | mode | 0 fixed dose, 1 EMG assist (the mode the session started in) |
| 125 | 1 | flags | bit 0 = degraded (fell back to Mode 0 during the session); other bits 0 |
| 126 | 1 | contractionsDone | u8, 0–20 |
| 127 | 2 | peakDeliveredMa | u16, tenths of mA (measured; no upper clamp: an over-current reading must be reported) |
| 129 | 2 | meanDeliveredMa | u16, tenths of mA |
| 131 | 2 | fatigueMdfDropPct | i16, tenths of %, `0x7FFF` = no valid EMG window |
| 133 | 2 | flexionMaxDeg | i16, tenths of a degree |
| 135 | 1 | stop cause | 0 none, 1 stop-button, 2 usb, 3 battery, 4 watchdog, 5 sensor-fault, 6 lead-off, 7 current-error, 8 over-current |
| 136 | 1 | count | u8, number of contraction records, ≤ 20 |
| 137 + 8k | 8 | contraction k | u8 index; u16 aV (tenths of % of reference MVC); u16 commandedMa (tenths of mA, must be ≤ 500); u16 peakMa (tenths of mA); u8 Model A label (0 under, 1 on-target, 2 fatigued, 3 guarding) |

Comfort and pain are not on the wire: the patient enters them in the app. Raw EMG and pulse-level data never leave the brace.

**SESSION_ACK:** delete the session with that id from flash (if present), then nothing to reply. Delete only on ACK, never on send. If the session store is full: OPEN (report the capacity and what you chose to do; do not delete unacknowledged sessions silently).

## Golden test vectors (must match byte for byte)
Golden plan (patientId `pt-2c8a6b9f`, planId `3f1d5c7e-8a2b-4c6d-9e0f-1a2b3c4d5e6f`, version 12, issuedAt 1791531000, expiresAt 1791660600, pulse 250 µs, ceiling 30 mA, floor 600 ‰, OFF 45 s, 10 contractions, target 30, reference 350 µV), 146 bytes:
```
534d42500101860070742d326338613662396600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f1d5c7e8a2b4c6d9e0f1a2b3c4d5e6f0c000000f897c86a3892ca6afa001e58022d0a1e5e010000000000000000000000000000000000000000000000000000000000000000599bb34b
```
Expected results for this frame, with the brace assigned to `pt-2c8a6b9f`:
- stored version 11, now 1791547200 → `accepted` (status 0), reply version 12;
- stored version 12 → `older-version` (8); now 1791660600 → `expired` (9);
- brace assigned to `pt-other` → `wrong-patient` (7);
- any single byte changed (XOR 0x01, 0x80 or 0xFF at any of the 146 positions) → never `accepted`;
- byte 94 of the payload (offset 102 in the frame) set to 55, with the CRC recomputed → `range` (6).

Golden session (sessionId `5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f`, same patient and plan, firmware `1.4.0`, 1791532800 → 1791534060, mode 1, not degraded, 2 contractions, peak 21.4 mA, mean 19.9 mA, fatigue 9.5 %, flexion 84.5°, stop cause lead-off; contraction 0: aV 28.4, commanded 18.0, peak 18.3, on-target; contraction 1: aV 22.1, commanded 21.0, peak 21.4, under), 165 bytes:
```
534d4250010299005d6e7f801a2b4c3d8e4f5a6b7c8d9e0f70742d326338613662396600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003f1d5c7e8a2b4c6d9e0f1a2b3c4d5e6f0c000000312e342e300000000000000000000000009fc86aeca3c86a010002d600c7005f004d030602001c01b400b7000101dd00d200d6000052cc38fe
```

## Deliverables
1. `link_config.h` (UUIDs, name prefix, buffer sizes), `crc32.{h,cpp}`, `frame.{h,cpp}` (reassembler, build/parse), `plan_codec.{h,cpp}` (decode + checks → status code), `session_codec.{h,cpp}` (encode), `plan_store.{h,cpp}` (two-slot storage), `session_store.{h,cpp}` (flash queue with delete-on-ack), `link_ble.{h,cpp}` (NimBLE server), `link_serial.{h,cpp}`, and the small integration in the existing core-1 task.
2. **Host unit tests** (PlatformIO `native` environment, Unity) that need no hardware: CRC check value; both golden frames (encode the golden session to exactly the hex above, decode the golden plan, every expected result listed above, the every-byte corruption sweep, every truncation length 0–145); the reassembler fed the two golden frames in chunks of 1, 3, 20, 182 bytes with junk bytes in front; a simulated power cut during each step of the plan-store write (the old or the new plan survives intact, never a mix).
3. A short `LINK.md`: how to build, flash and run the tests; the three UUIDs; memory and flash usage; how long a plan write and a 20-session upload take at MTU 23 and MTU 247.
4. A final report listing every `// OPEN:` item and every assumption.

## How it will be tested with the app
The app team runs the same frames from the phone (react-native-ble-plx, chunked writes with response, notifications) and from Chrome Web Serial, then the manual script `docs/BRACE_LINK_TESTS.md` (spec tests T-SW-01, T-SW-03, T-SW-05): 100 connect/sync cycles at 1 m and 5 m, a transfer cut mid-way (the brace must keep its plan), corrupted, wrong-patient, older and expired plans, and offline behaviour. All stimulation during these tests goes into the dummy load only.
