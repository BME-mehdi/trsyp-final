import { expect, type Page } from '@playwright/test'
import { patients } from '@symbiomed/fixtures'
import { totp } from '../server/totp'

export const SYN = Object.fromEntries(patients.map((p) => [p.label, p.patientId])) as Record<string, string>
export const FORBIDDEN = /(?<![\p{L}-])(safe|safely|validated|certified|compliant|secure|secured|clinical-grade|clinically validated|medical[- ]grade|improves recovery)(?![\p{L}-])/iu

/** Fills the mock identity provider form (same user, password and TOTP as the Keycloak demo realm). */
export async function fillLogin(page: Page, code = totp('symbiomed-demo-totp-secret')) {
  await page.getByLabel('User name').fill('clinician.demo')
  await page.getByLabel('Password').fill('demo-clinician')
  await page.getByLabel('One-time code').fill(code)
  await page.getByRole('button', { name: /sign in|confirm/i }).click()
}

export async function signIn(page: Page) {
  await page.goto('/signin')
  await page.getByRole('link', { name: 'Sign in' }).click()
  await fillLogin(page)
  await expect(page.getByRole('heading', { name: 'Worklist' })).toBeVisible()
}

/** Visible HTML without scripts: what a reader can see or a screen reader can announce. */
export const renderedHtml = async (page: Page) => (await page.content()).replace(/<script[\s\S]*?<\/script>/g, '')
