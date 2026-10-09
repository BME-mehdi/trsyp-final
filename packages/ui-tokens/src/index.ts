// Design tokens shared by the web (Tailwind) and mobile (StyleSheet) apps. Plain values, no platform code.
// One accent colour. Status colours only for the five status tones, always shown with a text label:
// colour never carries status on its own (WCAG 1.4.1).

export const colors = {
  text: '#1a1f24',
  textMuted: '#4a5560',
  background: '#ffffff',
  surface: '#f4f6f8',
  divider: '#d5dbe1', // decorative lines only
  control: '#6b7785', // borders of inputs and buttons: at least 3:1 on background (WCAG 1.4.11)
  accent: '#1a5f8a',
  onAccent: '#ffffff',
  focus: '#1a5f8a',
} as const

/** Five tones, following the spec's evidence palette: V positive, I info, S caution, D neutral, G critical. */
export const status = {
  positive: { fg: '#1d6b33', bg: '#e3f3e7' },
  info: { fg: '#1b4f99', bg: '#e5eefa' },
  caution: { fg: '#7a4a00', bg: '#fdf1d6' },
  neutral: { fg: '#3d4752', bg: '#eceff2' },
  critical: { fg: '#a1161b', bg: '#fbe5e5' },
} as const
export type StatusTone = keyof typeof status

/** Which tone each state uses. The label text comes from @symbiomed/i18n (patients) or the web app. */
export const statusTone = {
  plan: { draft: 'neutral', pending: 'caution', active: 'positive', expired: 'critical' },
  safety: { 'stop-pressed': 'critical', 'high-pain': 'critical', 'device-stop': 'caution', degraded: 'caution' },
  brace: { connected: 'positive', syncing: 'info', disconnected: 'neutral', error: 'critical' },
} as const satisfies Record<string, Record<string, StatusTone>>

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const
export const radius = { sm: 4, md: 8, pill: 999 } as const
/** Type scale in px (web) / pt (mobile). Body is 17 for readers aged 55–85; nothing smaller than 14. */
export const fontSize = { small: 14, body: 17, large: 20, title: 24, display: 30 } as const
export const lineHeight = 1.4
export const fontWeight = { regular: '400', semibold: '600' } as const
/** Minimum touch target, pt (CLAUDE.md, WCAG 2.5.8 asks for at least 24). */
export const touchTarget = 44

// ---- Extensions (UI elevation). The accent and the five status tones above stay as they are. ----

/**
 * Warm secondary palette, patient app only: progress fills, celebration and badges. Never used for
 * status, so it cannot be confused with the five tones. Pairs are in the contrast test.
 */
export const warm = {
  fill: '#a8501f', // ring and bar fills (graphic, 3:1 on background and track)
  track: '#f3e4d8', // empty part of a ring or bar (decorative)
  surface: '#fbf4ee', // celebration and recap cards
  ink: '#7a3510', // text on warm surfaces
  badgeBg: '#f6e6da', // earned badge
} as const

/** Soft page tint behind cards on the patient app. */
export const page = { patient: '#f7f5f2' } as const

/** Elevation: CSS box-shadow for the web, shadow props for React Native. */
export const elevation = {
  low: { css: '0 1px 2px rgb(26 31 36 / 0.06), 0 1px 3px rgb(26 31 36 / 0.08)', rn: { shadowColor: '#1a1f24', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 } },
  mid: { css: '0 4px 12px rgb(26 31 36 / 0.10)', rn: { shadowColor: '#1a1f24', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 } },
} as const

/** Motion: every duration is under 400 ms; with reduce motion on, apps use 0 (static equivalent). */
export const motion = {
  duration: { fast: 150, base: 250, slow: 380 },
  easing: { standard: [0.2, 0, 0, 1], decelerate: [0, 0, 0, 1] },
} as const

export const iconSize = { sm: 18, md: 24, lg: 32, xl: 44 } as const
export const radiusLg = { lg: 16, xl: 24 } as const

/** Atkinson Hyperlegible (Braille Institute, designed for low-vision readers). Names as loaded by expo-font. */
export const fontFamily = { regular: 'AtkinsonHyperlegible_400Regular', bold: 'AtkinsonHyperlegible_700Bold' } as const
