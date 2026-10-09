import { expect, test, type Page } from '@playwright/test'
import { patients } from '@symbiomed/fixtures'
import { totp } from '../server/totp'
import { FORBIDDEN, renderedHtml } from '../e2e/helpers'

async function keycloakSignIn(page: Page) {
  await page.goto('/signin')
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.locator('#username').fill('clinician.demo')
  await page.locator('#password').fill('demo-clinician')
  await page.locator('#kc-login').click()
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('#otp').fill(totp('symbiomed-demo-totp-secret'))
    await page.locator('#kc-login').click()
    if (await page.getByRole('heading', { name: 'Worklist' }).isVisible({ timeout: 10_000 }).catch(() => false)) return
    await page.waitForTimeout(31_000) // Keycloak refuses a code used twice: wait for the next one
  }
  await expect(page.getByRole('heading', { name: 'Worklist' })).toBeVisible()
}

test('production build: Keycloak sign-in with OTP, strict CSP with no violation, no forbidden words', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()))
  await keycloakSignIn(page)
  const own = patients[0]!.patientId
  for (const url of ['/', `/patients/${own}`, `/patients/${own}/sessions`, `/patients/${own}/charts`, `/patients/${own}/decisions`, `/patients/${own}/audit`, '/bench']) {
    const res = await page.goto(url)
    const csp = res!.headers()['content-security-policy']!
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic';/)
    expect(csp).toMatch(/style-src 'self' 'nonce-[^']+';/)
    expect(csp).not.toContain('unsafe-eval')
    await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect((await renderedHtml(page)).match(FORBIDDEN)?.[0], url).toBeUndefined()
  }
  expect(violations).toEqual([])
})

test('production build: sign-out ends the Keycloak session too', async ({ page }) => {
  await keycloakSignIn(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/signin\?reason=signed-out/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/signin/)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await expect(page.locator('#username')).toBeVisible() // Keycloak asks again: its session ended as well
})
