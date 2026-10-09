# Open questions

Unknowns the team must confirm (CLAUDE.md rule 7). Where code needs a value now, it uses the one listed here and says so in a comment; none of these is a confirmed clinical value.

## Answered (2026-10-09, Phase 1)
- **A_target range.** Fixed at 30 % of reference MVC (min = max = default) until the clinical adviser gives a range. Change it in `packages/domain/src/limits.ts`.
- **Reference MVC unit.** mV (UCUM `mV`), consistent with spec IV.1.
- **Pain-related STOP.** Any `stop-button` stop blocks a ceiling increase until the next approval. The contract has no field saying why STOP was pressed.
- **Rule window.** The pain ≥ 4/10, guarding > 30 % and STOP rules look at every session since the last approval.

## Open: values and rules (Phase 1 used the value shown)
1. **Ceiling step.** Whole mA, as assumed in CONTRACT.md §1 ("integer step assumed, confirm").
2. **Pulse-width step.** Whole µs is assumed; the contract gives only the range.
3. **Pain threshold 4/10 and guarding 30 %.** These are design values awaiting the clinical adviser (CONTRACT.md §1, spec VIII.2).
4. **"Falls by 5 mA" is read as a bound.** The suggestion is clamped to at most last − 5 mA, and a larger drop from the model is kept. When last − 5 is below 10 mA, the suggestion is 10 mA.
5. **"Blocks any increase" applies to the ceiling only.** OFF time and contractions are not limited by the pain or STOP rules.
6. **Session-level voluntary activation.** The FHIR Observation uses the mean A_v of the session's contractions. Confirm this, and define the patient's "muscle engagement score".
7. **AdverseEvent.actuality is `potential` for every brace stop.** Should a pain-related STOP be `actual`?
8. **Number of reasons.** The CONTRACT.md §3 example shows `reasons: []`, while the rule says exactly two. The schema enforces two.
9. **`fatigueMdfDropPct` is nullable** (no valid EMG window, e.g. a degraded session). Confirm with the firmware.
10. **`perContraction[].index`.** Is it 0- or 1-based? The fixtures use 0.
11. **`peakMa` and the delivered-current fields have no upper bound,** so an over-current reading still reaches the clinician. `commandedMa` above 50 mA is refused (spec IX.3).
12. **Plan version.** CarePlan `meta.versionId` carries the plan version. This holds only if the backend updates the plan CarePlan on approval and at no other time.
13. **Unknown fields.** A Plan with unknown fields is refused, since it goes to the brace. A SessionSummary drops unknown fields, so no upload is lost.
14. **Comfort 0–3 anchor words** shown to patients (en, fr) are provisional.
15. **Emergency number.** The app says "call emergency services" without a number. Which local number should it show?
16. **Flexion goal on the progress screen.** Is it 110° (the Model C threshold)? It is not in the contract.

## Open: Phase 2 (BFF)
17. **Model B endpoint.** Assumed `POST {SYMBIOMED_BACKEND_URL}/fhir/Patient/{id}/$suggest-plan`, returning a CarePlan proposal (`apps/web/server/extension/suggest-plan.ts`). Confirm the path, the authentication between BFF and backend, and the timeout (now 10 s).
18. **Care-team scope.** Any clinician may read any patient; there is no care-team assignment yet. Confirm before real data.
19. **POST decisions** records a decision against an existing plan version. The normal path is approve, which writes all three decisions atomically. Is a separate "reject suggestion" action needed (spec T-SW-02 lists reject)?
20. **Session upload** is allowed for the patient and for clinicians (clinic sessions, USB bench). Confirm.
21. **HAPI strips versions from references.** The plan version is therefore also carried in a `plan-version` extension on Procedure and Provenance.
22. **Clinician MFA** comes from Keycloak's conditional OTP: a clinician without an OTP credential logs in with a password only. The BFF still refuses approval without `amr` "otp". Should OTP be mandatory for every clinician at login?

## Open: Phase 3 (clinician web)
23. **Keycloak client type.** `symbiomed-web` is a public client with PKCE. A BFF can keep a secret, so a confidential client would be stronger.
24. **Session lifetime.** A web session lives on the BFF for 15 min idle and 12 h at most. Keycloak tokens are not refreshed after sign-in, so revoking a user in Keycloak takes effect at that user's next sign-in, not immediately.
25. **Draft decisions during step-up.** While the clinician signs in again, the draft decisions wait in the tab's sessionStorage. That includes override reasons (free text, with an on-screen warning not to enter personal details).
26. **Flexion goal 110°** on the chart is labelled "to confirm" (see 16).

## Open: Phase 4 (patient app)
27. **iOS keychain after uninstall.** Sign-out wipes everything, but on iOS the keychain can survive an uninstall. Add a first-launch wipe? (manual test M-20)
28. **Patient note** (200 characters) is stored on the comfort Observation, and clinicians cannot see it yet. Do we keep free text at all?
29. **Only the newest session can be rated**, so older unrated sessions stay unrated. Confirm.
30. **Engagement score** = mean activation of the last session as a percentage of the target (see 6).

## Open: Phase 5 (brace link)
31. **BLE UUIDs, advertised name and MTU:** fill in `apps/mobile/src/brace/ble-config.ts`. Until then the app uses the demo brace.
32. **Wire format v1** (docs/BRACE_PROTOCOL.md) needs firmware agreement, including the per-mille floor, µV reference MVC and whole-second times.
33. **Session ack:** the brace deletes a session only after the app has uploaded it. Confirm the firmware's storage size and what happens when it is full.
34. **The bench sends with no known "last version"**, so only the brace checks the version there.
35. **HMAC:** a reserved 32-byte field, zeros for now (decision D-11).
36. **react-native-ble-plx 3.5.1 with React Native 0.86 (new architecture)** is unverified until it runs on a device.

## Open: needed before later phases (not asked yet)
- Hosted auth provider (the dev realm is in `docker/keycloak`).
- Clinician roles beyond `clinician` and `admin`, and the hosting target.

## Phase 6: not done
- **TLS** anywhere (local HTTP); HSTS is sent but has no effect without it. No certificate pinning in the app.
- **CI** written (`.github/workflows/ci.yml`, Dependabot) but never run: the folder is not a git repository and not on GitHub.
- **Audit findings:** two high findings with no fix are accepted in Expo tooling (node-forge, braces), and three moderate ones stay open. Review by 2027-01-31.
- **Style attributes** are allowed by the CSP (`style-src-attr 'unsafe-inline'`); development also relaxes `style-src`.
- **Keycloak** has no password policy. Failed sign-ins are not logged by the BFF, and there is no log monitoring or alerting.
- **Privacy:** no consent screen, retention or deletion workflow, or DPIA (docs/PRIVACY_NOTES.md).
- **Rate limiter, web sessions and OIDC state** are in memory, per process.
- **No penetration test and no external review.**
- **Mobile:** no screenshot blocking (Android FLAG_SECURE), no tamper resistance, the banner is not covered by a test, and nothing has run on a real device.

## Phase 5: not done
- No BLE run on real hardware (UUIDs unknown). BleTransport is tested against a fake BLE manager only.
- No Python or C reference checker (on request of the firmware team only).
- Sessions stored on the brace while the phone is offline: the app has no local queue; they stay on the brace until the next sync.

## Phase 4: not done
- Not run on a real phone in this environment: biometrics, keychain, app switcher, BLE and system text scaling need docs/MOBILE_MANUAL_TESTS.md.
- No offline queue for ratings: when sending fails, the patient sees "Not sent, try again".
- No patient web view yet (CLAUDE.md mentions one, built from the same packages).

## Phase 3: not done
- e2e, axe and Lighthouse run against `next dev` in mock mode. Lighthouse covers accessibility only.
- No CSP or HSTS yet (Phase 6). CSRF protection and the cookie flags are done and tested.

## Phase 2: not done
- CSP, HSTS and the other headers beyond `no-store` and `nosniff`: Phase 6.
- The rate limiter is in memory, per process.
- HAPI runs on in-container H2: data is lost when the container is recreated. Reseed with `pnpm seed`.
- No HL7 validator run on the stored resources.
- No database-level patient compartment (HAPI's authorization interceptor). The BFF is the only enforcement point, and HAPI is bound to 127.0.0.1.

## Phase 1: not done
- FHIR StructureDefinitions for the extensions, and the HL7 validator run in CI. Both need the HAPI server from Phase 2.
- The HL7 v2 ORU^R01 adapter (a stretch deliverable in CONTRACT.md §5).
- Patient, Practitioner, PractitionerRole and Consent builders.
- Typed ESLint rules (typescript-eslint typed configs), to add with the apps.
- git: the folder is not a git repository, so no commits were made.
- Dark theme; Arabic strings and right-to-left layout.
- `docs/PLAN.md` was never written (the planning run was interrupted).
- The spec PDF is at the repository root, while CLAUDE.md expects it in `docs/`. `claude.md` is lowercase, so Claude Code does not load it automatically.
