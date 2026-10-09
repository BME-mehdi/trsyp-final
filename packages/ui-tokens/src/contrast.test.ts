import { describe, expect, it } from 'vitest'
import { colors, status } from './index'

// WCAG 2.x relative luminance and contrast ratio.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('contrast (WCAG 2.2 AA)', () => {
  it('computes known ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  it('gives every text pair at least 4.5:1', () => {
    const text: [string, string, string][] = [
      ['text/background', colors.text, colors.background],
      ['text/surface', colors.text, colors.surface],
      ['textMuted/background', colors.textMuted, colors.background],
      ['textMuted/surface', colors.textMuted, colors.surface],
      ['accent/background', colors.accent, colors.background],
      ['onAccent/accent', colors.onAccent, colors.accent],
      ...Object.entries(status).flatMap(([tone, c]): [string, string, string][] => [
        [`${tone} chip`, c.fg, c.bg],
        [`${tone} on background`, c.fg, colors.background],
      ]),
    ]
    expect(text.filter(([, fg, bg]) => contrast(fg, bg) < 4.5).map(([name, fg, bg]) => `${name} ${contrast(fg, bg).toFixed(2)}`)).toEqual([])
  })

  it('gives control borders and the focus ring at least 3:1', () => {
    for (const c of [colors.control, colors.focus]) expect(contrast(c, colors.background)).toBeGreaterThanOrEqual(3)
  })
})
