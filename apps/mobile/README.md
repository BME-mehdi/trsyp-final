# @symbiomed/mobile

Patient app (Expo SDK 57, Expo Router, development build). Screens: sign-in with biometric unlock, Today, pre-session checklist, Brace, After session, Progress, Emergency (offline), Settings.

- All text from `@symbiomed/i18n` (en, fr); tokens from `@symbiomed/ui-tokens`; data through `@symbiomed/api-client` with the patient's bearer token.
- Tokens and settings only in `expo-secure-store` (`src/storage.ts`); sign-out wipes every key and the query cache.
- An expired or missing plan is shown as such, never with its values (`src/logic.ts` `todayView`).
- No analytics, no crash reporting, no notifications. The screen is covered when the app leaves the foreground.

Run: `pnpm --filter @symbiomed/mobile start` with a development build (see docs/MOBILE_MANUAL_TESTS.md). Mock mode: `EXPO_PUBLIC_MOCK=1` against `pnpm dev:mock`.
Tests: `pnpm --filter @symbiomed/mobile test` (jest-expo). Bundle check: `npx expo export`.
