# @symbiomed/api-client

The BFF contract and a typed client for it, used by the web and mobile apps and by the BFF itself.

- `paths`: the BFF routes. Patient ids in paths are opaque.
- Request and response schemas (Zod): `ApproveRequestSchema`, `OutcomeRequestSchema`, `PlanResponseSchema`, `SessionsResponseSchema`, `ApiErrorSchema` and the others in `src/contract.ts`.
- `createApiClient({ baseUrl, getToken, fetch })`: validates every response and throws `ApiError(status, code)` on failure.

Plan limits are not repeated here: the BFF validates plans with `@symbiomed/domain`.
Contract tests live in `apps/web/test` and run against MSW and against the HAPI container.
