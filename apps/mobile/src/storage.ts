import * as SecureStore from 'expo-secure-store'

// Everything the app keeps on the phone lives here, in the Keychain / Keystore, never in plain storage.
export const KEYS = { access: 'symbiomed.access', refresh: 'symbiomed.refresh', expiresAt: 'symbiomed.expiresAt', settings: 'symbiomed.settings' } as const
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }

export const read = (k: string) => SecureStore.getItemAsync(k, OPTIONS)
export const write = (k: string, v: string) => SecureStore.setItemAsync(k, v, OPTIONS)
/** Sign-out: removes every key the app has ever written. */
export const wipe = () => Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k, OPTIONS)))
