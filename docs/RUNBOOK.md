# Runbook

Requirements: Node 24, pnpm (the version in `package.json` is fetched automatically), Docker with Compose for the full setup, Chrome or Edge for the bench page. Development and demonstration only: demo credentials, no TLS, synthetic data.

## 1. Install and check
```sh
pnpm install            # frozen versions; install scripts stay blocked
pnpm typecheck && pnpm lint && pnpm test
```

## 2. Mock mode (no Docker)
```sh
pnpm dev:mock           # http://localhost:3000
```
- FHIR is served from memory (MSW), seeded with the five synthetic patients, dates moved so that today is the last day of week 6. Data resets when the server restarts.
- Sign in: "Sign in" → mock sign-in page: `clinician.demo` / `demo-clinician` and the one-time code from an authenticator app set up with the secret below (tests compute it with `apps/web/server/totp.ts`).
- API tokens for scripts: `curl http://localhost:3000/api/dev/token?as=patient` (mock mode only).
- Patient app against mock mode: `apps/mobile/.env` with `EXPO_PUBLIC_MOCK=1` and `EXPO_PUBLIC_BFF_URL` set to this computer's LAN address, then `pnpm --filter @symbiomed/mobile start` with a development build (docs/MOBILE_MANUAL_TESTS.md).

Demo TOTP secret (dev realm only): raw bytes of `symbiomed-demo-totp-secret`; Base32 for an authenticator app: `ON4W2YTJN5WWKZBNMRSW23ZNORXXI4BNONSWG4TFOQ`.

## 3. With Docker (HAPI FHIR + Keycloak)
```sh
docker compose up -d                       # HAPI on 127.0.0.1:8090, Keycloak on 127.0.0.1:8180
pnpm seed                                  # loads the fixtures once (skips if already there)
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @symbiomed/web dev           # http://localhost:3000, real OIDC sign-in
```
Demo users: `clinician.demo` / `demo-clinician` + TOTP, `patient.demo` / `demo-patient`. Keycloak admin console: http://localhost:8180 (admin / admin, development only).
Model B: set `SYMBIOMED_BACKEND_URL` to the existing Node.js backend (`apps/web/server/extension/suggest-plan.ts`); unset, the stored suggestions are used.

## 4. Run the demonstration (spec B.7)
1. Start mock mode (section 2), or Docker (section 3) for the real sign-in.
2. Clinician: Worklist → SYN-03 (pending approval after a STOP press) → Next session: two reasons per value, "Clamped by rule", warnings. Accept two values, override one with a reason, "Review and approve", re-authenticate when asked.
3. Plan to the brace: phone → Brace → "Sync with the brace" (BLE once `apps/mobile/src/brace/ble-config.ts` is filled in, demo brace otherwise). Fallback: web Bench page (`NEXT_PUBLIC_FEATURE_BENCH=1`, USB cable, Chrome/Edge) → "Send approved plan".
4. Patient app: Today shows the new plan; after the session, rate comfort and pain; clinician sees it under Sessions and Charts.
5. Show the limits: an override of 55 mA cannot be approved; an expired plan (SYN-04) is never shown as current.

## 5. Reset data
- Mock mode: restart `pnpm dev:mock`.
- Docker: `docker compose up -d --force-recreate hapi && pnpm seed` (HAPI keeps data in the container only). Keycloak: `docker compose up -d --force-recreate keycloak` reimports the realm.
- Everything: `docker compose down`.
- Phone: Settings → Sign out (removes all app data from the phone).

## 6. Full verification (what CI runs)
```sh
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e                                   # Playwright on mock mode (flows, axe, Lighthouse, CSP, cookies)
docker compose up -d && pnpm seed
pnpm test:hapi                             # contract tests on HAPI + real Keycloak logins
pnpm e2e:prod                              # production build: Keycloak sign-in, strict CSP
pnpm --filter @symbiomed/mobile test
pnpm --filter @symbiomed/mobile export && pnpm --filter @symbiomed/web build
pnpm audit:high && pnpm scan && pnpm scan:bundles && pnpm sbom:generate
```
