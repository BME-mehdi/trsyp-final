import * as SecureStore from 'expo-secure-store'
import { DEMO, demoToken } from './demo'

// Everything the app keeps on the phone lives here, in the Keychain / Keystore, never in plain storage.
export const KEYS = { access: 'symbiomed.access', refresh: 'symbiomed.refresh', expiresAt: 'symbiomed.expiresAt', settings: 'symbiomed.settings' } as const
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }

// DEMO ONLY: in memory (works in a browser too), signed in as the synthetic demo patient. Gone on reload.
const memory = new Map<string, string>(DEMO ? [[KEYS.access, demoToken()]] : [])

export const read = (k: string) => (DEMO ? Promise.resolve(memory.get(k) ?? null) : SecureStore.getItemAsync(k, OPTIONS))
export const write = (k: string, v: string) => (DEMO ? Promise.resolve(void memory.set(k, v)) : SecureStore.setItemAsync(k, v, OPTIONS))
/** Sign-out: removes every key the app has ever written. */
export const wipe = () => (DEMO ? Promise.resolve(memory.clear()) : Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k, OPTIONS))))
