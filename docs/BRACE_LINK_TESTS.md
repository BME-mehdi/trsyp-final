# Brace link manual tests (maps to spec T-SW-01, T-SW-03, T-SW-05)

Run with the assembled brace on the bench (no person, stimulation into the dummy load only), the phone with a development build (docs/MOBILE_MANUAL_TESTS.md), and the BFF (`pnpm dev:mock`, or Docker with `pnpm seed`). Fill in `apps/mobile/src/brace/ble-config.ts` first; until then the app shows "Demo brace". Record every run: tag, date, initials, result.

Automated coverage already in place (no hardware): `pnpm --filter @symbiomed/brace-protocol test` (golden frames, round trips, every-byte corruption, expiry, wrong patient, lower version, disconnect mid-transfer, session sync), `pnpm --filter @symbiomed/mobile test` (BLE chunking and MTU, timeouts, Brace screen sync), `pnpm --filter @symbiomed/web test` (Web Serial transport), `pnpm test:hapi` (BFF plan integrity, T-SW-03).

## T-SW-01 BLE link (Must)
| # | Step | Pass |
|---|---|---|
| 1.1 | Phone at 1 m: Brace → "Sync with the brace", 100 times (connect, sync, disconnect) | ≥ 99 of 100 complete; each shows "Plan version N sent to the brace" or "already has a newer one" |
| 1.2 | Repeat at 5 m | ≥ 99 of 100 |
| 1.3 | During a plan transfer, switch the brace off (or walk out of range) | App shows "The connection was lost during the transfer. The brace keeps its last approved plan."; no automatic retry; the brace log shows the previous plan still active |
| 1.4 | Sync during a session on the dummy load | No change in the stimulation (scope trace unchanged); new plan takes effect only for the next session |
| 1.5 | USB-serial fallback: bench page (`NEXT_PUBLIC_FEATURE_BENCH=1`, Chrome or Edge), brace on USB between sessions: "Read sessions from the brace", then "Send approved plan" | Sessions uploaded; "The brace accepted plan version N"; pull the cable mid-transfer: "lost during the transfer (x of 146 bytes)", brace keeps its plan |

## T-SW-03 Plan integrity (Must)
| # | Step | Pass |
|---|---|---|
| 3.1 | BFF: `pnpm test:hapi` (approve 55 mA, lower version, other patient's token) | All refused (test output) |
| 3.2 | Send a plan with one byte changed (bench: modify the frame in a test build, or use the golden frame with a flipped byte) | Brace answers CRC, keeps its last plan |
| 3.3 | Send a plan for another patient (sign in as another demo patient on the same brace) | App refuses before sending; with the app check bypassed in a test build, the brace answers wrong-patient |
| 3.4 | Send an older version (bench, after a newer one is on the brace) | Brace answers older-version |
| 3.5 | Send an expired plan (let the plan expire, or use the expired demo patient SYN-04) | App refuses ("The brace will not start a session with this plan"); brace refuses to start a session with its stored expired plan |
| 3.6 | Out-of-range frame with a valid CRC (test build: ceiling 80 mA) | Brace answers range |

## T-SW-05 Offline behaviour (Should)
| # | Step | Pass |
|---|---|---|
| 5.1 | Phone off during a session | Session continues on the brace with the last valid plan; log buffered |
| 5.2 | Backend stopped, then sync | Sessions stay on the brace (no ack without upload); app shows "Sync did not finish. Your data is kept."; after the backend returns, the next sync uploads them, each exactly once |
| 5.3 | Network off, open Today and Emergency | Today shows the last known status or an error, never an old plan as current; Emergency works fully |
| 5.4 | No new approval: let the plan expire | Brace refuses to start; app shows "Plan expired" and asks to contact the physiotherapist |
