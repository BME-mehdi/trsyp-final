import { messages, t as translate, type Lang, type MessageKey } from '@symbiomed/i18n'
import { getLocales } from 'expo-localization'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { KEYS, read, write } from './storage'

export type TextScale = 1 | 1.25 | 1.5
export type Settings = { lang: Lang; textScale: TextScale; biometric: boolean }
const defaults = (): Settings => ({ lang: getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en', textScale: 1, biometric: false })

type Ctx = Settings & { set: (patch: Partial<Settings>) => void; reset: () => void; t: (key: MessageKey, vars?: Record<string, string | number>) => string }
const SettingsCtx = createContext<Ctx | null>(null)

export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: Partial<Settings> }) {
  const [s, setS] = useState<Settings>({ ...defaults(), ...initial })
  useEffect(() => {
    if (initial) return
    void read(KEYS.settings).then((v) => v && setS((cur) => ({ ...cur, ...(JSON.parse(v) as Partial<Settings>) })))
  }, [initial])
  const value = useMemo<Ctx>(() => ({
    ...s,
    set: (patch) => setS((cur) => {
      const next = { ...cur, ...patch }
      void write(KEYS.settings, JSON.stringify(next))
      return next
    }),
    reset: () => setS(defaults()),
    t: (key, vars) => translate(s.lang, key, vars),
  }), [s])
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>
}

export function useSettings() {
  const c = useContext(SettingsCtx)
  if (!c) throw new Error('useSettings outside SettingsProvider')
  return c
}
export const LANG_NAMES: Record<Lang, string> = { en: messages.en['language.en'], fr: messages.fr['language.fr'] }
