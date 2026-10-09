import { describe, expect, it } from 'vitest'
import { LANGS, messages, t, type Lang } from './index'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const whole = (w: string) => new RegExp(`(?<![\\p{L}-])${w}(?![\\p{L}-])`, 'iu')
// CONTRACT.md §6 and CLAUDE.md non-negotiable 1, with their French equivalents.
const FORBIDDEN: Record<Lang, RegExp[]> = {
  en: ['safe', 'safely', 'validated', 'certified', 'compliant', 'secure', 'secured', 'clinical-grade', 'clinically validated', 'medical[- ]grade', 'improves recovery'].map(whole),
  fr: ['sûre?s?', 'sécurisée?s?', 'sans danger', 'validée?s?', 'certifiée?s?', 'conformes?', 'qualité médicale', 'améliore la récupération'].map(whole),
}

describe('string tables', () => {
  it('has exactly the same keys in every language', () => {
    const keys = (lang: Lang) => Object.keys(messages[lang]).sort()
    for (const lang of LANGS) expect(keys(lang), lang).toEqual(keys('en'))
  })

  it('has the same placeholders for each key in every language', () => {
    const mismatched = LANGS.flatMap((lang) =>
      Object.entries(messages.en)
        .filter(([key, text]) => JSON.stringify(placeholders(text)) !== JSON.stringify(placeholders(messages[lang][key as keyof typeof messages.en])))
        .map(([key]) => `${lang}:${key}`),
    )
    expect(mismatched).toEqual([])
  })

  it('has no empty strings and none of the forbidden words', () => {
    for (const lang of LANGS) {
      for (const [key, text] of Object.entries(messages[lang])) {
        expect(text.trim(), `${lang}:${key}`).not.toBe('')
        for (const word of FORBIDDEN[lang]) expect(text, `${lang}:${key}`).not.toMatch(word)
      }
    }
  })

  it('shows the exact research-prototype banner', () => {
    expect(messages.en['banner.prototype']).toBe('Research prototype. Not a medical device. Stimulation into a dummy load only.')
  })
})

describe('t', () => {
  it('fills placeholders and leaves a missing one visible', () => {
    expect(t('fr', 'plan.sessionsToday', { done: 1, total: 2 })).toBe('Séances aujourd’hui\u00a0: 1 sur 2')
    expect(t('en', 'plan.sessionsToday', { done: 1 })).toBe('Sessions today: 1 of {total}')
    expect(t('en', 'plan.version', { toString: 'x' } as never)).toBe('Plan version {version}')
  })
})
