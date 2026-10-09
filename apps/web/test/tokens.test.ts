import { colors, status } from '@symbiomed/ui-tokens'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('keeps the Tailwind theme in step with @symbiomed/ui-tokens', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  const v = (name: string) => css.match(new RegExp(`--color-${name}: (#[0-9a-f]{6});`))?.[1]
  expect([v('ink'), v('muted'), v('page'), v('surface'), v('divider'), v('control'), v('accent'), v('on-accent')]).toEqual([
    colors.text, colors.textMuted, colors.background, colors.surface, colors.divider, colors.control, colors.accent, colors.onAccent,
  ])
  for (const [tone, c] of Object.entries(status)) expect([v(`${tone}-fg`), v(`${tone}-bg`)]).toEqual([c.fg, c.bg])
})
