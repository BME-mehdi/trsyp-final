import { useSyncExternalStore } from 'react'

// Rest-day requests: UI only for the demo (docs/OPEN_QUESTIONS.md item 40). Kept in memory on this
// phone, never sent to the BFF, never changes the plan. Holds a reason code and a day key, no free text.
export const REST_REASONS = ['tired', 'pain', 'swelling', 'other'] as const
export type RestReason = (typeof REST_REASONS)[number]
export type RestDay = { day: string; reason: RestReason }

let restDays: RestDay[] = []
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))

export const addRestDay = (r: RestDay) => {
  restDays = [...restDays.filter((x) => x.day !== r.day), r]
  listeners.forEach((l) => l())
}
export const clearRestDays = () => { restDays = []; listeners.forEach((l) => l()) }
export const useRestDays = () => useSyncExternalStore(subscribe, () => restDays)
/** Pain and swelling show the emergency guidance before anything else. */
export const needsGuidance = (r: RestReason) => r === 'pain' || r === 'swelling'
