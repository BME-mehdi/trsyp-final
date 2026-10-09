# Data contract (derived from SymbioMed Spec v3.0; field names proposed, backend to confirm)

## 1. Limits (single source: packages/domain/src/limits.ts)
| Name | Value | Note |
|---|---|---|
| frequencyHz | 50 | fixed, display only |
| pulseWidthUs | 150–400, default 250 | clinician sets once at first visit |
| rampUpS / holdS / rampDownS | 3 / 15 / 2 | fixed, display only |
| offS | one of 30, 45, 60, 90 | AI suggests, clinician validates |
| contractions | one of 10, 15, 20 | AI suggests, clinician validates |
| ceilingMa | 10–50 | cap from decision D-02; integer step assumed, confirm |
| floorFraction | 0.4–1.0, default 0.6 | 1.0 = fixed dose |
| aTargetPctMvc | default 30 | allowed range to confirm with clinical adviser |
| validityH | 12–168, default 36 | plan expiry |
| sessionsPerDay / minGapH | 2 / 3 | enforced by the brace; the app only displays |
| ai.maxIncreaseMaPerSession | +10 | |
| ai.decreaseMaAfterPainOrGuarding | −5 | after pain >= 4/10 or guarding > 30 % |
| comfort / pain scales | 0–3 / 0–10 | patient-entered after each session |
| kneeTargetDeg / gateDeg | 60 / ±10 | display only |
Open: pain threshold 4/10 and aTarget range are design values awaiting confirmation.

## 2. Plan (clinician -> backend -> app -> brace)
```json
{
  "planId": "uuid",
  "patientId": "opaque-id",
  "version": 12,
  "issuedAt": "ISO-8601 UTC",
  "expiresAt": "ISO-8601 UTC",
  "pulseWidthUs": 250,
  "ceilingMa": 30,
  "floorFraction": 0.6,
  "offS": 45,
  "contractions": 10,
  "aTargetPctMvc": 30,
  "referenceMvc": { "value": 0, "unit": "to confirm", "recordedAt": "ISO-8601", "recordedBy": "practitionerId" },
  "approvedBy": "practitionerId",
  "approvedAt": "ISO-8601 UTC"
}
```
Rules: `version` strictly increases per patient. A plan is valid only until `expiresAt`. The brace-side wire format (patientId, version, expiry, CRC-32; HMAC later) is built by `packages/brace-protocol` from this object. The reference MVC is recorded at the clinic and may only increase.

## 3. AI suggestion (backend -> clinician UI)
```json
{
  "suggestionId": "uuid", "patientId": "opaque-id", "basedOnSessionId": "uuid",
  "ceilingMa":    { "value": 35, "reasons": [{"feature":"comfort","text":"comfort rating 3/3","contribution":0.41},{"feature":"day","text":"day 29","contribution":0.22}], "clamped": false, "clampReason": null },
  "offS":         { "value": 45, "reasons": [], "clamped": false, "clampReason": null },
  "contractions": { "value": 15, "reasons": [], "clamped": false, "clampReason": null },
  "dataBasis": "simulated"
}
```
Exactly two reasons per value. `clamped` explains when a rule changed the model's raw value (+10 mA rule, −5 mA rule, 50 mA cap).

## 4. Session summary (brace -> app -> backend)
sessionId, patientId, planId, planVersion, firmwareVersion, startedAt, endedAt, mode (0 or 1), degraded (bool), contractionsDone, peakDeliveredMa, meanDeliveredMa, perContraction[] { index, aV (% reference MVC), commandedMa, peakMa, modelALabel (under | on-target | fatigued | guarding) }, fatigueMdfDropPct, flexionMaxDeg, safeStopCause (null or enum: stop-button, usb, battery, watchdog, sensor-fault, lead-off, current-error, over-current), plus patient-entered comfort (0–3) and pain (0–10) added by the app afterwards. Raw EMG and pulse-level data are never sent.

## 5. FHIR R4 mapping (profiles in packages/fhir, validated with Zod and, in CI, the HL7 FHIR validator against the HAPI server)
| Concept | FHIR resource | Notes |
|---|---|---|
| Patient | Patient | opaque ID in identifier; minimal demographics |
| Clinician | Practitioner, PractitionerRole | |
| Brace | Device | serial, firmware version in `version` |
| AI suggestion | CarePlan (status `draft`) | parameters as extensions; reasons in an extension; `dataBasis` extension |
| Approved plan | CarePlan (status `active`) | `period.end` = expiry; `meta.versionId` = version; `activity.detail` + extensions for limits; `author` = approving clinician |
| Accept / override decision | Provenance | per parameter: agent, recorded, `reason`; target = the CarePlan version |
| Session | Procedure | `performed[x]`, `usedReference` -> Device, extensions for mode, degraded, firmware |
| Pain 0–10 | Observation | LOINC for pain severity numeric rating (verify exact code before use), UCUM `{score}` |
| Comfort 0–3 | Observation | local code `comfort-0-3` |
| Knee flexion, voluntary activation, fatigue drop, peak delivered current | Observation | UCUM units (`deg`, `%`, `mA`); local codes where no exact standard code exists |
| Safe-stop, pain-related STOP, device fault | AdverseEvent or Flag | cause from the enum above; never contains free text with PHI |
| Access and changes | AuditEvent | every read/write; IDs only |
| Consent to data use | Consent | patient confirms in the app |

HL7 v2: FHIR is the primary interface. Add one outbound adapter `fhirObservationsToOruR01()` in `packages/fhir` (HL7 v2.5.1 ORU^R01 for session results) behind an interface, with unit tests on fixtures, marked as a stretch deliverable. No other HL7 v2 or CDA work.

## 6. Wording rules
Allowed: "research prototype", "simulated", "designed with reference to", "dummy load". Forbidden: safe, validated, certified, compliant, secure, clinical-grade, improves recovery.
