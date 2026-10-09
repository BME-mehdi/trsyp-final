# @symbiomed/domain

Spec constants, limits and plan rules. Pure TypeScript: no I/O, imports only zod.

- `LIMITS`: the single copy of docs/CONTRACT.md §1. The brace firmware and the backend enforce the same limits; UI checks are a convenience.
- Schemas and types: `PlanSchema`, `AiSuggestionSchema`, `SessionSummarySchema`, `ParameterDecisionSchema`, `BraceSchema`.
- `validatePlan(x)`, `isPlanExpired(plan, now)` (fails closed), `nextVersionOk(prev, next)`, `referenceMvcUpdateOk(prev, next)`.
- `clampSuggestion(raw, { lastCeilingMa, sessionsSinceApproval })`: at most +10 mA, −5 mA after pain ≥ 4/10 or guarding > 30 %, no increase after a STOP press, 50 mA cap. Output always inside LIMITS; non-finite input throws.

Tests: `pnpm --filter @symbiomed/domain test` (coverage ≥ 95 % enforced). Property tests compare `validatePlan` with an oracle built from LIMITS and run `clampSuggestion` on 10,000 random cases.
