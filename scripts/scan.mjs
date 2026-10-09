#!/usr/bin/env node
// Scans the repository and the built bundles for forbidden wording (CONTRACT.md §6, CLAUDE.md rule 1)
// and for secrets. Exit code 1 on any finding. Usage: node scripts/scan.mjs [--bundles]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'coverage', 'test-results', 'playwright-report', '.expo', 'screenshots', 'sbom'])
const TEXT = /\.(ts|tsx|js|mjs|json|md|yml|yaml|css|html|example)$/

// Files that must quote the forbidden list itself, or are not ours.
const WORDING_EXEMPT = {
  'claude.md': 'project rules: defines the list',
  'docs/CONTRACT.md': 'data contract: defines the list',
  'docs/NOT_CLAIMED.md': 'lists what is not claimed, word for word',
  'form_answers_improved.md': 'team form answers, not written by this project',
  'scripts/scan.mjs': 'this scanner',
  'apps/web/e2e/helpers.ts': 'test pattern of the list',
  'packages/i18n/src/i18n.test.ts': 'test pattern of the list',
}
// Technical names that contain a listed word but make no claim.
const TECHNICAL = [/expo-secure-store/g, /react-native-safe-area-context/g, /httpOnly, Secure/gi, /\bSecure;/g, /HttpOnly; Secure/g, /secure: (true|false)/g, /\bcookie\.secure\b/g, /isSecureContext/g, /cookie\.httpOnly, cookie\.secure/g]
const FORBIDDEN = /(?<![\p{L}\p{N}_])(safe|safely|validated|certified|compliant|secure|secured|clinical-grade|clinically validated|medical[- ]grade|improves recovery|sûre?s?|sécurisée?s?|sans danger|certifiée?s?|validée?s?|conformes?)(?![\p{L}\p{N}_])/giu

const SECRETS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'signed JWT'],
  [/(client_secret|api[_-]?key|secret_key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'secret assignment'],
]
// Dev-only demo credentials, documented in apps/web/README.md and docs/RUNBOOK.md; never valid outside the local realm.
const DEMO = /demo-clinician|demo-patient|symbiomed-demo-totp-secret|KC_BOOTSTRAP_ADMIN_PASSWORD: admin/

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  if (statSync(p).isDirectory()) return SKIP_DIRS.has(f) ? [] : walk(p)
  return TEXT.test(f) || f.startsWith('.env') ? [p] : []
})

const findings = []
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file)
  if (rel === 'pnpm-lock.yaml') continue
  if (/(^|\/)\.env(?!\.example)/.test(rel)) findings.push(`${rel}: environment file must not be committed (.env.example only)`)
  const text = readFileSync(file, 'utf8')
  text.split('\n').forEach((line, i) => {
    if (!WORDING_EXEMPT[rel]) {
      const clean = TECHNICAL.reduce((l, re) => l.replace(re, ''), line)
      for (const m of clean.matchAll(FORBIDDEN)) findings.push(`${rel}:${i + 1}: forbidden word "${m[0]}"`)
    }
    for (const [re, what] of SECRETS) if (re.test(line) && !DEMO.test(line)) findings.push(`${rel}:${i + 1}: possible ${what}`)
    if (/dangerouslySetInnerHTML/.test(line) && /\.(tsx?|jsx?)$/.test(rel)) findings.push(`${rel}:${i + 1}: dangerouslySetInnerHTML is not allowed (CLAUDE.md)`)
  })
}

// Reviewed third-party messages and identifiers in the bundles (none is shown to users):
const THIRD_PARTY = [
  /you can safely remove invocation of/, // React Native deprecation notice
  /as it's not secure/, // expo-auth-session: PKCE "plain" method refused
  /must be within the safe integer range/, // zod error message
  /safe\(e\)\{return this\.check/, // zod method name
  /No safe area value available/, // react-native-safe-area-context
  /react-native-safe-area-context/,
]
const FORBIDDEN_EN = /(?<![\p{L}\p{N}_])(safe|safely|validated|certified|compliant|secure|secured|clinical-grade|clinically validated|medical[- ]grade|improves recovery)(?![\p{L}\p{N}_])/giu

// Built bundles: what actually ships. Client code must hold no demo credential and no secret.
if (process.argv.includes('--bundles')) {
  const bundles = [join(ROOT, 'apps/web/.next/static'), join(ROOT, 'apps/mobile/dist')].filter(existsSync)
  if (bundles.length < 2) findings.push(`bundles missing: build the web app (next build) and export the mobile app (expo export) first`)
  const files = bundles.flatMap(function all(d) {
    return readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? all(join(d, f)) : [join(d, f)]))
  })
  for (const f of files.filter((x) => /\.(js|hbc|css|html|json)$/.test(x))) {
    const text = readFileSync(f).toString('latin1')
    if (DEMO.test(text)) findings.push(`${relative(ROOT, f)}: demo credential in a shipped bundle`)
    for (const [re, what] of SECRETS) if (re.test(text)) findings.push(`${relative(ROOT, f)}: possible ${what} in a shipped bundle`)
    // Every listed word in a shipped bundle fails the scan, except these reviewed third-party developer messages.
    for (const m of text.matchAll(FORBIDDEN_EN)) {
      const context = text.slice(Math.max(0, m.index - 60), m.index + 60)
      if (!THIRD_PARTY.some((re) => re.test(context))) findings.push(`${relative(ROOT, f)}: forbidden word in shipped code: "${context.replace(/[^\x20-\x7e]/g, ' ').trim()}"`)
    }
  }
  console.log(`scan: ${files.length} bundle files checked`)
}

if (findings.length) {
  console.error(findings.join('\n'))
  console.error(`scan: ${findings.length} finding(s)`)
  process.exit(1)
}
console.log('scan: no forbidden wording, no secrets')
