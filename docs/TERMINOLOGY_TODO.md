# Terminology TODO

Local codes are used where no exact standard code was confirmed (CLAUDE.md rule 6). Each line is `<CodeSystem>#<code>`. All local CodeSystems live under `https://symbiomed.example/fhir/CodeSystem/` and are defined in `packages/fhir/src/codesystems.ts`. A test fails if a local code is missing here.

"Candidate" means a standard code the team could check; none of the candidates below has been verified.

## Standard codes in use
- LOINC `72514-3` "Pain severity - 0-10 verbal numeric rating [Score] - Reported", checked 2026-10-09 on NLM Clinical Tables and tx.fhir.org (LOINC 2.82, active). To confirm with the clinical adviser: the code says "verbal", but the app collects the rating on screen.
- UCUM units: `{score}`, `deg`, `%`, `mA`, `us`, `s`, `mV`.
- HL7 code systems: `observation-category` (`survey`, `procedure`), `audit-event-type#rest`, `restful-interaction`.

## observation (session results)
- `observation#comfort-0-3`: patient comfort rating after a session, 0–3. Candidate: none known; project scale.
- `observation#knee-flexion-max`: maximum knee flexion in a session, in deg. Candidate: a LOINC or SNOMED CT knee flexion range-of-motion code.
- `observation#voluntary-activation`: mean voluntary activation (A_v), % of reference MVC. Candidate: none known.
- `observation#fatigue-mdf-drop`: EMG median-frequency drop across the session, %. Candidate: none known.
- `observation#peak-delivered-current`: peak delivered stimulation current, mA. Candidate: ISO/IEEE 11073 device nomenclature.

## stop-cause (why the brace stopped a session)
Candidate for all eight: IMDRF Annex A device problem codes.
- `stop-cause#stop-button`
- `stop-cause#usb`
- `stop-cause#battery`
- `stop-cause#watchdog`
- `stop-cause#sensor-fault`
- `stop-cause#lead-off`
- `stop-cause#current-error`
- `stop-cause#over-current`

## activity
- `activity#nmes-session`: seated isometric NMES session (CarePlan activity, Procedure code). Candidate: a SNOMED CT procedure code for neuromuscular electrical stimulation.

## Project-specific codes (no standard equivalent expected)
- `model-a-label#under`, `model-a-label#on-target`, `model-a-label#fatigued`, `model-a-label#guarding`
- `plan-parameter#ceilingMa`, `plan-parameter#offS`, `plan-parameter#contractions`
- `clamp-reason#max-increase`, `clamp-reason#pain-or-guarding`, `clamp-reason#stop-pressed`, `clamp-reason#ceiling-cap`, `clamp-reason#ceiling-min`, `clamp-reason#not-allowed-value`
- `decision#accept`, `decision#override`
- `data-basis#simulated`
