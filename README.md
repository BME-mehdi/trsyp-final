# SymbioMed (trsyp-final)

**Research prototype. Not a medical device. Stimulation into a dummy load only.**

Clinician web app, patient mobile app and shared packages for the SymbioMed knee brace (NMES after total knee arthroplasty). The AI only suggests; a clinician accepts or overrides every parameter.

| Path | What |
|---|---|
| `apps/web` | Clinician web app and BFF (Next.js) |
| `apps/mobile` | Patient app (Expo) |
| `packages/*` | domain limits and rules, FHIR mapping, brace protocol, API client, i18n (en, fr), design tokens, synthetic fixtures |
| `docs/` | Contract, threat model, security checklist, open questions, runbook |

## Run
```sh
pnpm install
pnpm dev:mock        # http://localhost:3000, no Docker; sign in as clinician.demo / demo-clinician + one-time code
```
Full setup with HAPI FHIR and Keycloak, the demo script and data reset: [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Check
```sh
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e
```

Not claimed: see [docs/NOT_CLAIMED.md](docs/NOT_CLAIMED.md). Open items: [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md).
