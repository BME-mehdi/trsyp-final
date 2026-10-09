# Security checklist

Items from OWASP ASVS 4.0.3 (web and BFF, level 2 as the reference) and OWASP MASVS 2 (patient app), plus the project rules in CLAUDE.md. Requirements are paraphrased; the IDs point to the source. Nothing here is a claim of conformity (NOT_CLAIMED.md).

Status rule: **done** only when a test or a command output listed under Evidence shows it, and that evidence was run for this release (see "Last verification" at the end). **partial**: part of it is shown, or it is configured but not shown. **not done**: not built or not shown at all.

Evidence paths are relative to the repository root. `pnpm test` runs every unit and contract test on the in-memory FHIR server; `pnpm test:hapi` and `pnpm e2e:prod` need `docker compose up -d && pnpm seed`.

## Web app and BFF (ASVS 4.0.3)
| # | ASVS | Requirement | Status | Evidence / what is missing |
|---|---|---|---|---|
| A-01 | V1.1.2 | Threat model kept with the design | partial | [THREAT_MODEL.md](THREAT_MODEL.md). A document, not a test. |
| A-02 | V2.1.1–2.1.7 | Password policy (length, breached-password check) | not done | Delegated to Keycloak; no password policy is configured in the dev realm. |
| A-03 | V2.2.1 | Limits on credential guessing | partial | BFF limit per account and per address on failed sign-in: [contract.test.ts](../apps/web/test/contract.test.ts) "rate-limits per account". Keycloak brute-force protection is switched on in the realm but not tested. |
| A-04 | V2.2.3 / V2.8 | Second factor for clinicians | partial | Approval refused without an OTP sign-in: contract.test.ts step-up tests; real TOTP login: [keycloak.test.ts](../apps/web/test/keycloak.test.ts), [production.spec.ts](../apps/web/e2e-prod/production.spec.ts). Keycloak asks for OTP only when the account has one (OPEN_QUESTIONS 22). |
| A-05 | V3.2.1 | New session identifier at every sign-in | done | [auth-routes.test.ts](../apps/web/test/auth-routes.test.ts) "a new sign-in replaces the old session". |
| A-06 | V3.2.2 | Session identifier with at least 64 bits of entropy | done | 256-bit random id; auth-routes.test.ts checks the cookie value length and format. |
| A-07 | V3.3.1 | Sign-out ends the session | done | auth-routes.test.ts "logout needs the CSRF token, then … ends the server session"; production.spec.ts "sign-out ends the Keycloak session too". |
| A-08 | V3.3.2 | Session ends after 15 min of inactivity | done | [web-session.test.ts](../apps/web/test/web-session.test.ts) "ends a session after 15 minutes without activity"; [clinician.spec.ts](../apps/web/e2e/clinician.spec.ts) "session timeout". |
| A-09 | V3.4.1–3.4.5 | Cookie flags (`HttpOnly; Secure; SameSite=Strict`, `__Host-` prefix, path) | done | auth-routes.test.ts (Set-Cookie); [security.spec.ts](../apps/web/e2e/security.spec.ts) (as the browser stores it); keycloak.test.ts (OIDC callback). |
| A-10 | V3.5.3 | Tokens are signed and checked | done | contract.test.ts "refuses missing, forged and role-less tokens"; keycloak.test.ts (Keycloak keys). |
| A-11 | V3.7.1 | Fresh sign-in before a sensitive action (plan approval) | done | contract.test.ts "refuses a clinician without a fresh step-up"; keycloak.test.ts "approves after a password + TOTP login"; clinician.spec.ts "approve after step-up". |
| A-12 | V4.1.1, V4.1.3 | Access control on the server, least privilege by role | done | contract.test.ts "keeps clinician-only routes from patients", "refuses … role-less tokens"; web-session.test.ts worklist for clinicians only. |
| A-13 | V4.2.1 | No access to another patient's records by changing an id | done | contract.test.ts "refuses a patient token on another patient's plan"; keycloak.test.ts "reads their own plan and nobody else's". |
| A-14 | V4.2.2 | CSRF protection on writes | done | web-session.test.ts; auth-routes.test.ts; security.spec.ts. |
| A-15 | V5.1.3, V5.1.4 | Input checked against schemas at every boundary | done | contract.test.ts 400 cases; [plan.test.ts](../packages/domain/src/plan.test.ts) property test; [client.test.ts](../packages/api-client/src/client.test.ts) "refuses a response that breaks the contract". |
| A-16 | V5.3.3 | Output encoding against XSS | partial | React escaping, no `dangerouslySetInnerHTML` (`pnpm scan`), CSP (A-27). No dedicated injection test. |
| A-17 | V7.1.1, V7.1.2 | No personal data or credentials in logs | done | [log-scrubbing.test.ts](../apps/web/test/log-scrubbing.test.ts) (planted personal data never reaches console output or audit records). |
| A-18 | V7.4.1 | Generic error messages, no internal details | done | log-scrubbing.test.ts "error responses never echo the input, whatever fails". |
| A-19 | V7.1.3, V7.2.1 | Security events recorded | partial | AuditEvent on every read and write of patient data, and on refused access: contract.test.ts "writes an AuditEvent for every read", "… and audits the attempt". Failed sign-ins are not recorded by the BFF; no log monitoring. |
| A-20 | V8.2.1 | No caching of sensitive responses | done | [security-headers.test.ts](../apps/web/test/security-headers.test.ts); contract.test.ts "marks every response no-store". |
| A-21 | V8.3.1 | Sensitive data in the body, never in the URL | partial | URLs carry opaque ids only (`packages/api-client` paths); no automated check. |
| A-22 | V9.1.1 | TLS for all client connections | not done | Local development over HTTP. HSTS header is sent (A-29). |
| A-23 | V9.2.1 | TLS between the BFF, HAPI and Keycloak | not done | Local Docker network over HTTP. |
| A-24 | V14.2.1 | Dependencies free of known vulnerabilities | partial | `pnpm audit:high` exit 0 at high level with two reviewed exceptions (SUP-3). CI workflow written, not yet run on GitHub. |
| A-25 | V14.2.5 (inventory) | Software bill of materials | done | `pnpm sbom:generate` → CycloneDX 1.7, 1,113 components. |
| A-26 | V14.3.2 | No debug features in production | done | auth-routes.test.ts "refuses development sign-in in a production build", "dev-only routes do not exist outside mock mode". |
| A-27 | V14.4.3 | Content Security Policy | done | security-headers.test.ts (nonce per request, `strict-dynamic`, no `unsafe-inline` or `unsafe-eval` for scripts in production); production.spec.ts "strict CSP with no violation"; security.spec.ts. Style attributes are allowed (`style-src-attr 'unsafe-inline'`); development relaxes `style-src`. |
| A-28 | V14.4.4 | `X-Content-Type-Options: nosniff` | done | security-headers.test.ts. |
| A-29 | V14.4.5 | HSTS | partial | Header sent (security-headers.test.ts); only effective once TLS is deployed (A-22). |
| A-30 | V14.4.6 | Referrer-Policy | done | security-headers.test.ts (`no-referrer`). |
| A-31 | V14.4.7 | No framing by other sites | done | security-headers.test.ts (`frame-ancestors 'none'`, `X-Frame-Options: DENY`). |
| A-32 | V14.5.3 | Cross-origin reads limited | partial | No CORS headers are sent, so browsers refuse cross-origin reads; not tested. |
| A-33 | V2.10.4, V14.1.3 | Secrets out of the code; fail fast on missing configuration | partial | `.env.example` only, `pnpm scan` (repo) and `pnpm scan:bundles` (shipped code) find no secret; auth-routes.test.ts "… and a missing variable at start". No secret store for a hosted deployment. |

## Patient app (MASVS 2)
| # | MASVS | Requirement | Status | Evidence / what is missing |
|---|---|---|---|---|
| M-01 | STORAGE-1 | Sensitive data only in the platform key store | done | [security.test.ts](../apps/mobile/test/security.test.ts) "keeps data only in expo-secure-store"; [settings.test.tsx](../apps/mobile/test/settings.test.tsx) "sign-out wipes every stored key". |
| M-02 | STORAGE-2 | No data leaks (backups, logs, snapshots) | partial | [privacy.test.tsx](../apps/mobile/test/privacy.test.tsx); no analytics (security.test.ts); `allowBackup: false` in app.json (not tested on a device); iOS keychain after uninstall is open (OPEN_QUESTIONS 27, manual M-20). |
| M-03 | CRYPTO-1, CRYPTO-2 | Cryptography and keys | not done | The app does no cryptography of its own; the plan HMAC with a per-brace key is not built (T-21). |
| M-04 | AUTH-1 | Standard sign-in protocol | partial | Code + PKCE with Keycloak shown for the web BFF (keycloak.test.ts). The mobile flow uses expo-auth-session but has not run on a device (manual M-02). |
| M-05 | AUTH-2 | Local authentication (biometrics) | partial | [sign-in.test.tsx](../apps/mobile/test/sign-in.test.tsx) with a mocked module; device test pending (manual M-03). |
| M-06 | AUTH-3 | Extra authentication for sensitive actions | not done | No sensitive action in the patient app beyond reading and rating; no step-up built. |
| M-07 | NETWORK-1 | TLS for all traffic | not done | Development over HTTP. |
| M-08 | NETWORK-2 | Certificate pinning | not done | Documented follow-up (CLAUDE.md). |
| M-09 | PLATFORM-1 | Deep links and IPC | partial | Only the `symbiomed://auth` redirect; PKCE protects the code. Not tested on a device. |
| M-10 | PLATFORM-2 | No WebView | done | security.test.ts "has no WebView". |
| M-11 | PLATFORM-3 | No data in screenshots or the app switcher | partial | Cover screen when backgrounded (privacy.test.tsx). Screenshot and screen-recording blocking (Android FLAG_SECURE) not done. |
| M-12 | CODE-1 | Current platform | partial | Expo SDK 57 (current stable), React Native 0.86. Minimum OS versions not set. |
| M-13 | CODE-3 | No known vulnerable dependencies | partial | `pnpm audit:high` (SUP-3). |
| M-14 | CODE-4 | Input checked | done | [after-session.test.tsx](../apps/mobile/test/after-session.test.tsx) (out-of-range values cannot be sent); `decodeSession` schema ([codec.test.ts](../packages/brace-protocol/src/codec.test.ts)); client.test.ts. |
| M-15 | RESILIENCE-1–4 | Tamper and reverse-engineering resistance | not done | Out of scope for the MVP. |
| M-16 | PRIVACY-1 | Data minimisation | partial | Opaque ids, no names or dates of birth ([fixtures.test.ts](../packages/fixtures/src/fixtures.test.ts)); the optional free-text note can still hold personal data (warning shown). |
| M-17 | PRIVACY-3 | Transparency and consent | not done | No consent screen; FHIR Consent not built. |
| M-18 | PRIVACY-4 | User control over their data | partial | Sign-out removes all local data (settings.test.tsx); no way to ask for deletion on the server. |

## Project rules (CLAUDE.md)
| # | Rule | Status | Evidence / what is missing |
|---|---|---|---|
| R-01 | Research-prototype banner on every screen | partial | Web: clinician.spec.ts checks the banner on every page. Mobile: the banner is in the root layout, not covered by a test. |
| R-02 | Forbidden wording absent from UI text, docs and code | done | [i18n.test.ts](../packages/i18n/src/i18n.test.ts); clinician.spec.ts (rendered HTML); production.spec.ts; `pnpm scan`; `pnpm scan:bundles` (built web and mobile bundles, reviewed third-party messages excepted in `scripts/scan.mjs`). |
| R-03 | AI values labelled simulated, never applied without a decision per parameter | done | clinician.spec.ts "reviewing a suggestion", "accept two values, override one"; `dataBasis` must be `simulated` ([suggestion.test.ts](../packages/domain/src/suggestion.test.ts)). |
| R-04 | Limits in one package; UI never offers an out-of-range value; server and brace check again | done | domain property tests; clinician.spec.ts "a value outside the limits blocks the approval"; contract.test.ts "refuses a ceiling of 55 mA"; codec.test.ts range tests. |
| R-05 | No stimulation control from the UI | partial | [checklist.test.tsx](../apps/mobile/test/checklist.test.tsx) (no call to the brace or the network); review of the code. No automated check over every screen. |
| R-06 | No personal data in logs, error reports, fixtures | done | log-scrubbing.test.ts; fixtures.test.ts "carries no names, dates of birth or contact details". |
| R-07 | No personal data in analytics or notifications | done | Mobile security.test.ts (no analytics, crash-reporting or notification SDK). |
| R-08 | Only an approved, unexpired plan of the signed-in patient goes to the brace | done | [link.test.ts](../packages/brace-protocol/src/link.test.ts) "refuses a plan … before writing any byte"; [brace.test.tsx](../apps/mobile/test/brace.test.tsx) "an expired plan is refused in the app". |

## Supply chain
| # | Item | Status | Evidence / what is missing |
|---|---|---|---|
| SUP-1 | Lockfile and exact versions | partial | `pnpm-lock.yaml`, exact pins, `--frozen-lockfile` in CI. The folder is not a git repository yet, so nothing is committed. |
| SUP-2 | Audit in CI | partial | `pnpm audit:high` in [.github/workflows/ci.yml](../.github/workflows/ci.yml); run locally (exit 0), CI not yet run on GitHub. |
| SUP-3 | Known findings reviewed | partial | Two high findings with no fix, accepted in `pnpm-workspace.yaml` with reasons and a review date (2027-01-31): node-forge (GHSA-86w9-cpqp-85rv, via @expo/cli) and braces (GHSA-vfj7-8cjw-p6xm, via the jest preset). Three moderate findings in the same tooling stay open. |
| SUP-4 | Dependency updates | partial | [dependabot.yml](../.github/dependabot.yml); active only once the repository is on GitHub. |
| SUP-5 | SBOM | done | `pnpm sbom:generate` (A-25). |
| SUP-6 | No install scripts from unknown packages | done | pnpm blocks install scripts; esbuild is listed as not allowed in `pnpm-workspace.yaml`; `pnpm install` completes with this policy. |
| SUP-7 | CI actions pinned | partial | Pinned by commit SHA in ci.yml; not yet run. |
| SUP-8 | Minimum release age for new versions | done | pnpm 12 default (one day); vite was pinned to an older patch rather than exempted. |

## Last verification
Run on 2026-10-09 against this tree, outputs shown in the Phase 6 report: `pnpm typecheck && pnpm lint && pnpm test`, `pnpm e2e`, `pnpm test:hapi`, `pnpm e2e:prod`, `pnpm audit:high`, `pnpm scan`, `pnpm scan:bundles`, `pnpm sbom:generate`.
