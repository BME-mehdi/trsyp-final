// Native modules are replaced by small in-memory fakes; each test can inspect them.
const mockStore = new Map<string, string>()
;(globalThis as { __secureStore?: Map<string, string> }).__secureStore = mockStore

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}))
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(async () => ({ success: true })),
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
}))
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'symbiomed://auth/callback',
  useAutoDiscovery: () => null,
  useAuthRequest: () => [null, null, jest.fn()],
  refreshAsync: jest.fn(),
  exchangeCodeAsync: jest.fn(),
}))
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }))
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }))
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }))
jest.mock('@react-native-community/slider', () => {
  const { View } = jest.requireActual('react-native')
  const React = jest.requireActual('react')
  return { __esModule: true, default: (p: object) => React.createElement(View, p) }
})
