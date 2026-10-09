import { expect, test } from '@playwright/test'
import { SYN, signIn } from './helpers'

test('every page: CSP with a per-request nonce on every script, and no CSP violation', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()))
  await page.exposeFunction('reportViolation', (v: string) => violations.push(v))
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { reportViolation(v: string): void }).reportViolation(`${e.violatedDirective} ${e.blockedURI}`)))

  const first = await page.goto('/signin')
  const csp = first!.headers()['content-security-policy']!
  const nonce = csp.match(/'nonce-([^']+)'/)![1]!
  // Every <script> in the HTML the server sent carries this response's nonce. Scripts Next loads
  // later run under 'strict-dynamic', which only a nonce-bearing script can start.
  const tags = (await first!.text()).match(/<script\b[^>]*>/g) ?? []
  expect(tags.length).toBeGreaterThan(0)
  expect(tags.filter((t) => !t.includes(`nonce="${nonce}"`))).toEqual([])
  expect(first!.headers()['x-frame-options']).toBe('DENY')

  await signIn(page)
  for (const url of ['/', `/patients/${SYN['SYN-03']}`, `/patients/${SYN['SYN-01']}/charts`, `/patients/${SYN['SYN-01']}/audit`, '/bench']) {
    const res = await page.goto(url)
    expect(res!.headers()['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    expect(res!.headers()['cache-control']).toContain('no-store')
    await page.waitForLoadState('networkidle')
  }
  expect(violations).toEqual([])
})

test('session cookie flags as the browser stores them, and a write without the CSRF token is refused', async ({ page, context }) => {
  await signIn(page)
  const cookie = (await context.cookies()).find((c) => c.name === '__Host-symbiomed-session')!
  expect([cookie.httpOnly, cookie.secure, cookie.sameSite, cookie.path]).toEqual([true, true, 'Strict', '/'])
  expect(await page.evaluate(() => document.cookie)).not.toContain('symbiomed-session') // not readable by scripts
  const res = await page.request.post(`/api/patients/${SYN['SYN-01']}/decisions`, { data: {} })
  expect(res.status()).toBe(403)
  expect((await res.json()).message).toBe('Missing or invalid CSRF token')
})
