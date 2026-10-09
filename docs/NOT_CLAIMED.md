# Not claimed

SymbioMed is a research prototype. It is not a medical device, and no stimulation has been applied to a person: stimulation goes into a dummy load only. This page lists every standard and compliance statement the project does **not** make, and why. It is the only document allowed to quote the forbidden words (CONTRACT.md §6): the scanner (`scripts/scan.mjs`) exempts it for that reason.

Wording we use instead: "research prototype", "simulated", "designed with reference to", "dummy load".

## Standards: designed with reference to, conformity not claimed
| Standard | Why it is not claimed |
|---|---|
| IEC 60601-1, IEC 60601-1-11, IEC 60601-1-2, IEC 60601-2-10 | Electrical, home-use, EMC and nerve-stimulator requirements for medical equipment. No testing laboratory has assessed the brace; the safety chain is implemented but its fault-injection campaign has not been run (spec X.6). |
| ISO 14971 | Risk management is used as a reference for the FMEA and the UI risks (THREAT_MODEL.md); there is no risk management file under a quality system. |
| IEC 62304 | Software life-cycle used as a process reference only; no software development plan, safety classification or maintenance plan under 62304. |
| IEC 62366-1 | No usability engineering file; only accessibility checks (axe, Lighthouse) and planned usability sessions (T-SYS-04). |
| IEC 81001-5-1 | Health-software security activities are a reference for the threat model and checklist; no conforming process or evidence set. |
| ISO 13485 | No quality management system. |
| ISO 10993-1, IEC 62133-2 | Biocompatibility of skin-contact parts and battery safety are not assessed. |
| OWASP ASVS (level 2) | Used as a checklist (SECURITY_CHECKLIST.md); several items are partial or not done (TLS, password policy, monitoring). Not verified by a third party. |
| OWASP MASVS | Same: checklist only; network, resilience and privacy items are not done. |
| HL7 FHIR R4 profiles | Resources are R4 and parsed with the official type definitions, but there are no StructureDefinitions and the HL7 validator has not been run. Not "FHIR compliant" or "conformant". |
| SMART on FHIR | The scope model is a design reference; the BFF does not implement SMART launch or scopes. |
| WCAG 2.2 AA | Automated checks pass (axe: no serious or critical violation; Lighthouse accessibility 100 on the audited pages). No manual audit with assistive technology yet. Not "WCAG compliant". |

## Regulation and law: not claimed
| Statement not made | Why |
|---|---|
| CE marked, MDR compliant (EU 2017/745) | A therapeutic stimulator would likely be class IIa or higher; no regulatory process has started (spec X.5, SY-05). |
| FDA cleared or approved (21 CFR 890.5850) | No submission. |
| GDPR compliant; compliant with Tunisian data-protection law (Loi organique 2004-63) | Legal basis, records of processing, DPIA, retention and data-subject rights are open items for the team and a legal adviser (PRIVACY_NOTES.md). |
| HIPAA compliant | Not assessed; not a US deployment. |

## Words and claims never used, and why
| Never said | Why |
|---|---|
| "safe", "safe for patients", "clinically safe" | No test on a person; safety layers implemented but not yet verified on the assembled device. |
| "secure", "encrypted", "secured data" | Local prototype over HTTP; TLS, hosting and a security review are not done (SECURITY_CHECKLIST.md A-22, A-23). |
| "validated", "clinically validated" | AI results are simulated only; the controller and protocol have no clinical study. |
| "certified", "medical grade", "clinical-grade" | No certification of any kind. |
| "compliant" (with any standard or law) | See the tables above. |
| "improves recovery", "reduces pain" | No clinical evidence; simulated results check the loop, not patients. |
| "The AI controls stimulation", "autonomous" | The AI only suggests; a clinician decides every parameter; the brace enforces its own limits. |

The technical names `Secure` (a cookie attribute), `expo-secure-store` (a library), `SAFE_STOP` and `safeStopCause` (spec state and contract field names) are not claims and stay as they are.
