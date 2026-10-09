// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.MOCK_MODE === '1') {
    const { startMockMode } = await import('./mocks/node')
    startMockMode()
  }
  const { config } = await import('./server/config')
  config() // fail fast on a missing or invalid variable
}
