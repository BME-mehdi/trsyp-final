import { en, type MessageKey } from './en'
import { fr } from './fr'

export type { MessageKey }
export const messages = { en, fr } satisfies Record<string, Record<MessageKey, string>>
export type Lang = keyof typeof messages
export const LANGS = Object.keys(messages) as Lang[]

/** The string for `key` with its `{name}` placeholders filled. A missing value stays visible as `{name}`. */
export function t(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (match, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : match))
}
