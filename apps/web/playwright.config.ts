import { defineConfig } from '@playwright/test'

// E2E against `pnpm dev:mock`: in-memory FHIR (MSW) and the mock sign-in, no Docker. State is shared, so tests run in order.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  globalSetup: './e2e/warm-up.ts',
  use: { baseURL: 'http://localhost:3000', viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'pnpm dev:mock',
    url: 'http://localhost:3000/signin',
    timeout: 180_000,
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_FEATURE_BENCH: '1' },
  },
})
