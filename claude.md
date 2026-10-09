# SymbioMed UI: rules for Claude Code

## What this is
Two interfaces for a research prototype knee brace that delivers NMES after total knee arthroplasty:
- Clinician web app (Next.js, App Router, TypeScript).
- Patient mobile app (Expo, React Native, TypeScript), with a responsive patient web view reusing the same packages.
The spec is `SymbioMed_Spec_v3.0_Final_MVP.pdf` (repo root). The data contract is `docs/CONTRACT.md`. If they disagree, stop and ask.

## Non-negotiables
1. **Research prototype, not a medical device.** Every screen shows a persistent banner: "Research prototype. Not a medical device. Stimulation into a dummy load only." Never write "safe", "clinically validated", "certified", "compliant", "secure" or "medical grade" in UI text, docs or comments. Say "designed with reference to".
2. **AI suggests, the clinician decides.** The UI never applies an AI value. Every parameter is accepted or overridden one by one by a clinician, and the decision is logged. AI results are labelled "simulated" until the team says otherwise.
3. **Limits live in one package** (`packages/domain`), copied from CONTRACT.md. UI validation is a convenience. The brace firmware and the backend enforce the limits; the UI must never be the only check and must never offer a value outside the limits.
4. **No stimulation control from the UI.** The apps can send an approved plan and receive logs. There is no "start stimulation", no live current slider, no remote command. STOP is a hardware button; the app only shows guidance.
5. **No PHI in logs, URLs, analytics, push notifications, error reports or test fixtures.** Use synthetic patients only. Patient IDs in the app are opaque.
6. **No invented medical codes.** Use LOINC, SNOMED CT and UCUM only where you are sure of the exact code. Otherwise use a local CodeSystem `https://symbiomed.example/fhir/CodeSystem/...` and add a `TODO(terminology)` comment plus a line in `docs/TERMINOLOGY_TODO.md`.
7. **Don't guess unknowns.** Unknowns are listed in `docs/OPEN_QUESTIONS.md`. Ask the user; do not fill them in silently.

## Stack (check current stable versions yourself and pin them exactly)
- Monorepo: pnpm workspaces + Turborepo. TypeScript strict. No `any` without a comment.
- Web: Next.js App Router, React Server Components where useful, Tailwind CSS, Radix primitives. No component library beyond that.
- Mobile: Expo (managed workflow with a development build via EAS, because BLE needs native code), Expo Router, plain React Native StyleSheet using shared design tokens. No NativeWind.
- Data: TanStack Query on the client. Zod for every boundary. `@types/fhir` (R4) for FHIR types.
- Charts: Recharts on web; a tiny shared SVG sparkline/line component on mobile (`react-native-svg`). No heavy chart libraries on mobile.
- Tests: Vitest (packages), React Testing Library, Playwright (web e2e), jest-expo (mobile). MSW for mocks.
- Dev infrastructure: `docker-compose.yml` with a HAPI FHIR server (R4) and Keycloak (OIDC). A mock mode (MSW + fixtures) must work with no Docker.

## Architecture (modular, minimal)

apps/ web/ clinician UI + BFF route handlers (Next.js) mobile/ patient UI (Expo) packages/ domain/ spec constants, limits, clamp rules, plan types and validators (pure, no I/O) fhir/ FHIR R4 builders and parsers, profiles, terminology, Zod schemas brace-protocol/ plan <-> bytes, CRC-32, session-summary decoding, transport interface api-client/ typed client for the BFF/FHIR API, used by both apps ui-tokens/ colours, spacing, type scale, status chips (shared by web and mobile) i18n/ string tables (en, fr; ar later), no inline patient-facing strings elsewhere fixtures/ synthetic patients, plans, sessions for mocks and tests docs/ SPEC pdf, CONTRACT.md, THREAT_MODEL.md, SECURITY_CHECKLIST.md, OPEN_QUESTIONS.md, TERMINOLOGY_TODO.md

Rules: packages never import from apps. `domain` imports nothing. Each package has its own tests and README of at most 20 lines. Features are vertical slices under `apps/*/features/<name>`. Keep files under ~200 lines; split before they grow.

## Security baseline (build to these, document what is not done)
- Reference points: OWASP ASVS level 2 (web/BFF), OWASP MASVS (mobile), SMART on FHIR / OAuth 2.0 scopes, IEC 81001-5-1 and IEC 62304 as process references, ISO 14971 for the safety-related UI risks. GDPR and Tunisian data-protection law as privacy references (the team confirms the legal basis). None of these is claimed as met.
- Auth: OIDC authorization code flow with PKCE. Web: tokens live only on the server (BFF), browser holds an httpOnly, Secure, SameSite=Strict session cookie. Never put tokens in localStorage or in URLs. Mobile: `expo-auth-session`, tokens in `expo-secure-store`, optional biometric unlock with `expo-local-authentication`.
- Authorisation: roles `patient`, `clinician`, `admin`. FHIR scopes `patient/*.rs` for patients and `user/*.cruds` limited by role for clinicians. Enforce on the server; a patient can only read their own compartment. The UI hides what a role cannot do, but never relies on hiding.
- Clinicians: MFA required. Approving a plan needs a step-up (re-authentication within the last 5 minutes). Idle timeout 15 minutes on web.
- Plan approval records: a FHIR `Provenance` (who, when, what changed, reason) and an `AuditEvent` for every read and write of patient data. Audit messages carry IDs only.
- Web hardening: strict CSP with nonces, HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, CSRF protection on every state-changing route, `Cache-Control: no-store` on patient data, rate limiting on BFF routes, input validation with Zod on every route, no `dangerouslySetInnerHTML`.
- Mobile hardening: no PHI in screenshots when backgrounded (blur overlay), no PHI in notifications, no secrets in the bundle, certificate pinning left as a documented follow-up.
- Supply chain: lockfile committed, `pnpm audit` in CI, Renovate or Dependabot config, SBOM generation script, no postinstall scripts from unknown packages.
- Secrets: `.env.example` only; fail fast at start if a required variable is missing.

## Working agreement
- Always: plan first, then small commits, then run the verification commands for the phase before saying "done".
- Verification commands: `pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm e2e` (web) and `pnpm --filter mobile test` when relevant. Report the real output. Never claim a test passed that you did not run.
- Don't add libraries without saying why in the commit message. Prefer the platform and what is already installed.
- Accessibility: WCAG 2.2 AA targets, 44 pt touch targets on mobile, readable at 200 % text size (patients are 55–85 years). Never use colour alone to carry status.
- Style. Clinician web: calm and dense, motion only for focus, loading and state changes. Patient app: warm and encouraging. Allowed: icons, simple original illustrations (no stock or copyrighted art), purposeful motion under 400 ms (progress fills, completion celebration, screen transitions) and light haptics. Every animation respects the system reduce-motion setting and has a static equivalent. Status colours stay reserved for the five status tones. Gamification follows .claude/skills/rehab-gamification/SKILL.md.
- When you finish a phase, update `docs/OPEN_QUESTIONS.md` and list what you did not do.
