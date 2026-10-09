# Threat model (final for the MVP)

Scope: clinician web app and BFF (`apps/web`), patient app (`apps/mobile`), brace link (`packages/brace-protocol`, BLE and USB-serial), the FHIR server (HAPI) and the identity provider (Keycloak) as the BFF uses them. The brace firmware and hardware are out of scope here; the spec (sections X and B.6) covers them. Method: STRIDE per component. This is a research prototype, designed with reference to OWASP ASVS, OWASP MASVS and IEC 81001-5-1; it does not claim to meet them (see NOT_CLAIMED.md).

Evidence column: the test or command that shows the control works. "None" means the control is designed but not shown by a test; see SECURITY_CHECKLIST.md for status.

## Assets
Patient data (plans, sessions, ratings, notes), clinician decisions and the audit trail, access tokens and web sessions, the approved plan on its way to the brace, demo credentials (development only).

## Trust boundaries
Browser ↔ BFF (session cookie). Phone ↔ BFF (bearer token). BFF ↔ HAPI (server side, local network). Browser/phone ↔ Keycloak (OIDC). Phone or bench browser ↔ brace (BLE or USB-serial, not authenticated in the MVP).

## STRIDE
| ID | Component | STRIDE | Threat | Control (CLAUDE.md section) | Evidence |
|---|---|---|---|---|---|
| T-01 | BFF | Spoofing | Forged or stolen bearer token | JWT signature, issuer and audience checked (jose); Keycloak keys from JWKS (Auth) | `apps/web/test/contract.test.ts` "refuses missing, forged and role-less tokens"; `test/keycloak.test.ts` |
| T-02 | BFF | Spoofing | Session fixation or hijacking of the web session | Server-side session, new id at every sign-in, `__Host-` cookie with HttpOnly, Secure, SameSite=Strict (Auth) | `test/auth-routes.test.ts`; `e2e/security.spec.ts`; `test/keycloak.test.ts` "web sign-in through the BFF" |
| T-03 | BFF | Spoofing | Clinician account taken over by password only | MFA (TOTP) in Keycloak; approval needs `amr` otp and a sign-in from the last 5 min (Auth) | `test/contract.test.ts` step-up tests; `test/keycloak.test.ts` "approves after a password + TOTP login"; `e2e-prod/production.spec.ts` |
| T-04 | BFF | Tampering | Cross-site request forges a write with the clinician's cookie | SameSite=Strict, CSRF token header, Origin check (Web hardening) | `test/web-session.test.ts`; `test/auth-routes.test.ts`; `e2e/security.spec.ts` |
| T-05 | BFF | Tampering | Plan outside the limits, lower version, lowered reference MVC, decision not matching the suggestion | `validatePlan`, `nextVersionOk`, `referenceMvcUpdateOk`, decision schema, If-Match on the FHIR transaction (Limits live in one package) | `test/contract.test.ts` plan approval tests; `packages/domain` property tests |
| T-06 | BFF | Tampering | XSS injecting script into the clinician UI | React escaping, no `dangerouslySetInnerHTML`, CSP with per-request nonce and `strict-dynamic` (Web hardening) | `test/security-headers.test.ts`; `e2e/security.spec.ts`; `e2e-prod/production.spec.ts`; `pnpm scan` |
| T-07 | BFF | Repudiation | A clinician denies approving or overriding | Provenance per parameter and AuditEvent in the same FHIR transaction (Plan approval records) | `test/contract.test.ts` "approves the next version in one transaction" |
| T-08 | BFF | Information disclosure | A patient reads another patient's data | Patient compartment checked on every route; role checks (Authorisation) | `test/contract.test.ts` "refuses a patient token on another patient's plan"; `test/keycloak.test.ts` |
| T-09 | BFF | Information disclosure | Personal data in logs, error responses, URLs or audit records | Errors return codes only; logs carry error names; AuditEvent holds IDs only; opaque ids in URLs (No PHI in logs) | `test/log-scrubbing.test.ts`; `packages/fhir` audit schema test |
| T-10 | BFF | Information disclosure | Patient data cached by the browser or a proxy | `Cache-Control: no-store` on every response (Web hardening) | `test/security-headers.test.ts`; `test/contract.test.ts` "marks every response no-store" |
| T-11 | BFF | Denial of service | Request flooding or token guessing | Rate limit per account and per address on failed sign-in (Web hardening) | `test/contract.test.ts` "rate-limits per account" |
| T-12 | BFF | Elevation of privilege | Patient or admin calls clinician routes | Role allow-list per route (Authorisation) | `test/contract.test.ts` "keeps clinician-only routes from patients"; worklist test in `test/web-session.test.ts` |
| T-13 | BFF | Elevation of privilege | Development sign-in left on in production | `AUTH_MODE=dev` refused when `NODE_ENV=production`; dev routes 404 outside mock mode (Secrets) | `test/auth-routes.test.ts` |
| T-14 | BFF ↔ HAPI | Tampering / disclosure | HAPI reachable by others; no authorisation in HAPI itself | HAPI bound to 127.0.0.1 in docker-compose; BFF is the only client | None (configuration only) |
| T-15 | Mobile | Spoofing | Stolen phone used to read data | Tokens in expo-secure-store (Keychain/Keystore, this device only), optional biometric lock on return from background (Mobile hardening) | `apps/mobile/test/sign-in.test.tsx`; `test/security.test.ts`; manual M-03 |
| T-16 | Mobile | Information disclosure | Data visible in the app switcher snapshot | Cover screen when the app leaves the foreground (Mobile hardening) | `test/privacy.test.tsx`; manual M-04 |
| T-17 | Mobile | Information disclosure | Data leaks to analytics, crash reporting or notifications | No such SDK; no notifications (No PHI in notifications) | `apps/mobile/test/security.test.ts`; manual M-18, M-19 |
| T-18 | Mobile | Information disclosure | Data left on the phone after sign-out | Sign-out wipes every stored key and the query cache | `test/settings.test.tsx` "sign-out wipes every stored key"; manual M-17, M-20 |
| T-19 | Mobile | Tampering | Network attacker between phone and BFF | TLS in deployment; certificate pinning is a documented follow-up (Mobile hardening) | None: local development runs over HTTP |
| T-20 | Brace link | Tampering | Corrupted plan (radio noise, cable fault) | CRC-32 over every frame; brace and app check before use (decision D-11) | `packages/brace-protocol/src/codec.test.ts` every-byte corruption |
| T-21 | Brace link | Tampering | Deliberately altered or forged plan (attacker in BLE range) | Not covered: CRC is not authentication. HMAC with a per-brace key planned after the MVP (reserved field) | None (not done) |
| T-22 | Brace link | Spoofing | Plan for another patient, expired, or replayed older version | Patient id, expiry and version checked in the app before sending and on the brace (decision D-11) | `packages/brace-protocol/src/link.test.ts`; `apps/mobile/test/brace.test.tsx` |
| T-23 | Brace link | Denial of service | Link drops during a transfer | No silent retry; partial frame dropped on reconnect; brace keeps its last valid plan | `link.test.ts` "disconnect mid-transfer"; `apps/mobile/test/ble.test.ts`; `apps/web/features/bench/serial.test.ts` |
| T-24 | Brace link | Information disclosure | Session data read over BLE by a nearby device | Not covered in the MVP (no link encryption or pairing policy defined) | None (not done) |
| T-25 | Brace link | Repudiation / loss | Session lost between brace and backend | The brace deletes a session only after the app confirms the upload | `link.test.ts` "keeps a session on the brace when its upload fails" |
| T-26 | Supply chain | Tampering | Malicious or vulnerable dependency | Lockfile, exact pins, install scripts blocked, minimum release age, `pnpm audit:high`, SBOM, Dependabot, actions pinned by SHA (Supply chain) | `pnpm audit:high` and `pnpm sbom:generate` output; CI workflow (not yet run on GitHub) |
| T-27 | Repository | Information disclosure | Secrets committed | `.env.example` only; secret patterns scanned in the repo and the built bundles (Secrets) | `pnpm scan`, `pnpm scan:bundles` |

## Safety-related UI risks (ISO 14971 as a reference)
| ID | Risk | Control | Evidence |
|---|---|---|---|
| U-01 | An AI value is applied without a clinician decision | Every parameter needs accept or override; approval disabled until then; server checks the decisions | `apps/web/e2e/clinician.spec.ts`; `test/contract.test.ts` |
| U-02 | A value outside the limits is offered or approved | UI never offers it; server refuses it (`validatePlan`); brace refuses it | `e2e/clinician.spec.ts` "a value outside the limits blocks the approval"; `test/contract.test.ts` "refuses a ceiling of 55 mA"; brace-protocol range tests |
| U-03 | An old plan is shown to the patient as current | Today screen carries no plan values once expired | `apps/mobile/test/today.test.tsx` |
| U-04 | The app is mistaken for a stimulation control | No start, stop or current control anywhere; checklist only changes the display; STOP guidance points to the hardware button | `apps/mobile/test/checklist.test.tsx`; emergency strings |
| U-05 | Emergency guidance unavailable offline | Emergency screen built from bundled strings only | `apps/mobile/test/emergency.test.tsx` |
| U-06 | Approval despite pain or a STOP press | Warnings in the approval dialog; −5 mA and no-increase rules in `clampSuggestion` | `e2e/clinician.spec.ts` "reviewing a suggestion"; domain property tests |
