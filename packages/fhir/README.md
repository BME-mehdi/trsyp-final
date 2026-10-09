# @symbiomed/fhir

FHIR R4 builders and parsers for the CONTRACT.md §5 mapping. Parsers take untyped JSON and return domain objects checked against the domain schemas.

| Domain | FHIR | Functions |
|---|---|---|
| AiSuggestion | CarePlan `draft` | `suggestionToCarePlan`, `carePlanToSuggestion` |
| Plan | CarePlan `active`, `meta.versionId` = version | `planToCarePlan`, `carePlanToPlan` |
| ParameterDecision | Provenance (one per parameter) | `decisionToProvenance`, `provenanceToDecision` |
| SessionSummary | Procedure + Observations + AdverseEvent | `sessionToFhir`, `sessionFromFhir` |
| Brace | Device | `braceToDevice`, `deviceToBrace` |
| AuditRecord (IDs only) | AuditEvent | `auditToAuditEvent`, `auditEventToRecord` |

Terminology: LOINC 72514-3 for pain, UCUM units, local CodeSystems in `src/codesystems.ts` (`LOCAL_CODE_SYSTEMS`), each code listed in docs/TERMINOLOGY_TODO.md.
Not yet: StructureDefinitions for the extensions, the HL7 validator run, the HL7 v2 ORU^R01 adapter.
