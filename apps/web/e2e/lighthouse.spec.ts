import { chromium, expect, test } from '@playwright/test'
import lighthouse from 'lighthouse'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SYN, fillLogin } from './helpers'

// Lighthouse accessibility audit of the main pages, signed in (same browser profile, so the session cookie is used).
test('Lighthouse accessibility score is at least 95 on every main page', async () => {
  test.setTimeout(300_000)
  const port = 9333
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'lh-')), { args: [`--remote-debugging-port=${port}`] })
  const page = await context.newPage()
  await page.goto('http://localhost:3000/signin')
  const signinScore = await audit('http://localhost:3000/signin')
  await page.getByRole('link', { name: 'Sign in' }).click()
  await fillLogin(page)
  await expect(page.getByRole('heading', { name: 'Worklist' })).toBeVisible()

  const scores: Record<string, number> = { '/signin': signinScore }
  for (const path of ['/', `/patients/${SYN['SYN-03']}`, `/patients/${SYN['SYN-02']}/sessions`, `/patients/${SYN['SYN-01']}/charts`, `/patients/${SYN['SYN-04']}/decisions`, `/patients/${SYN['SYN-01']}/audit`]) {
    scores[path] = await audit(`http://localhost:3000${path}`)
  }
  console.log('Lighthouse accessibility:', JSON.stringify(scores))
  await context.close()
  for (const [path, score] of Object.entries(scores)) expect(score, path).toBeGreaterThanOrEqual(95)

  async function audit(url: string) {
    const r = await lighthouse(url, { port, output: 'json', logLevel: 'error', onlyCategories: ['accessibility'], formFactor: 'desktop', screenEmulation: { disabled: true } })
    const failed = Object.values(r!.lhr.audits).filter((a) => a.score === 0 && a.scoreDisplayMode === 'binary').map((a) => a.id)
    if (failed.length) console.log(url, 'failed audits:', failed.join(', '))
    return Math.round((r!.lhr.categories.accessibility?.score ?? 0) * 100)
  }
})
