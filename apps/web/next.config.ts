import type { NextConfig } from 'next'

const config: NextConfig = {
  // Workspace packages ship TypeScript sources.
  transpilePackages: ['@symbiomed/api-client', '@symbiomed/domain', '@symbiomed/fhir', '@symbiomed/fixtures'],
  poweredByHeader: false,
  devIndicators: false,
}
export default config
