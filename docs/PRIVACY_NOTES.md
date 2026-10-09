# Privacy notes

What the prototype does with personal data today, and the open items for the team and a legal adviser. Reference frameworks: GDPR and the Tunisian personal-data law (Organic Law 2004-63); the team confirms which applies and the legal basis. Nothing here is legal advice, and no compliance is claimed (NOT_CLAIMED.md).

## What is processed
| Data | Where | Why | Notes |
|---|---|---|---|
| Opaque patient id, study label (e.g. SYN-01) | Keycloak attribute, FHIR Patient | Link the account to the records | No name, date of birth, address or contact data in the app or the FHIR records |
| Plans, AI suggestions, clinician decisions | FHIR CarePlan, Provenance | Therapy plan and decision log | Decisions are also used to retrain Model B (purpose to state in the consent) |
| Session summaries (current, activation, flexion, fatigue, stop cause) | FHIR Procedure, Observation, AdverseEvent | Follow-up by the physiotherapist | No raw EMG and no pulse-level data leave the brace |
| Comfort, pain, optional note (200 characters) | FHIR Observation | Patient-reported outcomes | The note is free text: the app warns not to write personal details |
| Audit trail (who read or changed which record) | FHIR AuditEvent | Accountability | Identifiers only |
| Clinician account (user name, e-mail, OTP secret) | Keycloak | Sign-in | Demo accounts only in development |
| Tokens, settings | Phone key store (expo-secure-store) | Stay signed in | Wiped at sign-out |

Not collected: location, contacts, analytics, crash reports, advertising ids, notifications.

## Minimisation already in place
Opaque ids in URLs and audit records; no personal data in logs or error responses (`apps/web/test/log-scrubbing.test.ts`); synthetic fixtures only; the patient app keeps nothing after sign-out; the app switcher snapshot is covered.

## Open items (team and legal adviser)
1. **Role and legal basis.** Who is the controller (clinic, university, team)? Which basis: consent for research, or care? Which law applies to the pilot?
2. **Consent.** Text and flow in the app (FHIR Consent is planned, not built): research use, retraining of the model on clinician decisions and patient data, right to withdraw.
3. **Ethics approval** for any use with patients or volunteers (spec XI.3), including the data management plan.
4. **Retention.** How long to keep sessions, ratings, notes and audit records; what happens at the end of the six weeks and at the end of the study. No deletion job exists today.
5. **Data-subject rights.** Access, rectification, erasure, restriction, portability: no workflow exists. FHIR export per patient is possible but not built.
6. **DPIA.** Health data plus an AI component most likely needs a data-protection impact assessment before a pilot.
7. **Hosting and transfers.** Where the backend, HAPI and Keycloak will run; processor agreements; transfers outside Tunisia or the EU.
8. **Security for hosting.** TLS, encryption at rest, backups, access review, log monitoring (SECURITY_CHECKLIST.md: not done items).
9. **Free-text note.** Keep it, restrict it to choices, or drop it (OPEN_QUESTIONS 28).
10. **Pseudonymisation key.** Who holds the link between the opaque id and the real person (outside this system), and how it is protected.
11. **Breach procedure** and the authority to notify (INPDP in Tunisia; the relevant EU authority if applicable).
12. **Model retraining data.** What leaves the clinic for retraining, in what form (aggregated, pseudonymised), and under which agreement.
