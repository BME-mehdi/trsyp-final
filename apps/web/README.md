# @symbiomed/web

Clinician web app (Phase 3) and the BFF: Next.js route handlers under `app/api/patients/[id]/…` that map to FHIR calls on HAPI.

- Routes: GET plan, POST plan/approve, GET suggestion, POST decisions, GET/POST sessions, POST outcomes. Contract: `@symbiomed/api-client`.
- Every route: bearer token (Keycloak, or dev key in mock mode), rate limit, role check, patient compartment, Zod body, AuditEvent on every read and write (denials too).
- Approve: MFA + step-up within 5 min (RFC 9470 challenge), plan checked against the `@symbiomed/domain` limits, version must be current + 1, reference MVC upward only, one FHIR transaction (CarePlan, suggestion status, 3 Provenance, AuditEvent) with If-Match.
- Model B: **extension point** in `server/extension/suggest-plan.ts` (`$suggest-plan`, set `SYMBIOMED_BACKEND_URL`). Unset: the pending suggestion from the fixtures.

Screens (`app/(clinician)`): worklist, next-session panel (accept or override per parameter, step-up approval), sessions, safety events, charts, decision log, audit, bench (flag `NEXT_PUBLIC_FEATURE_BENCH=1`).
Sign-in: OIDC code + PKCE with Keycloak (`/api/auth/*`), server-side session in a `__Host-` httpOnly SameSite=Strict cookie, CSRF header on writes, 15 min idle timeout. Mock mode uses `/dev-login`.
Run: `pnpm dev:mock` (no Docker; MSW serves FHIR from memory, tokens at `/api/dev/token?as=clinician|patient`), or `docker compose up -d && pnpm seed && pnpm --filter @symbiomed/web dev` with `.env.local` from `.env.example`.
Tests: `pnpm test` (contract tests on MSW); `pnpm e2e` (Playwright on mock mode: flows, axe, forbidden words, Lighthouse, screenshots in docs/screenshots); `pnpm test:hapi` (same tests on HAPI plus real Keycloak logins; needs `docker compose up -d` and `pnpm seed`).
Demo users (dev realm only): `clinician.demo` / `demo-clinician` + TOTP (secret `symbiomed-demo-totp-secret`, raw bytes), `patient.demo` / `demo-patient`.
