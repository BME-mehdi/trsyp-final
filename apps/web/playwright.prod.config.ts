import { defineConfig } from '@playwright/test'

// Production build against Docker (HAPI + Keycloak): real OIDC sign-in, strict production CSP.
// Needs `docker compose up -d && pnpm seed`. Run: pnpm --filter @symbiomed/web e2e:prod
export default defineConfig({
  testDir: 'e2e-prod',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'next build && next start -p 3000',
    url: 'http://localhost:3000/signin',
    timeout: 600_000,
    reuseExistingServer: false,
    env: {
      FHIR_BASE_URL: 'http://localhost:8090/fhir',
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: 'http://localhost:8180/realms/symbiomed',
      OIDC_AUDIENCE: 'symbiomed-bff',
      APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_FEATURE_BENCH: '1',
    },
  },
})
