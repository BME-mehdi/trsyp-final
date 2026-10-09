// Takes screenshots of the main clinician screens in demo mode (`pnpm demo` must be running).
// Usage: npx tsx scripts/demo-shots.ts <out-dir> [path ...]
import { chromium } from '@playwright/test'

const [out = 'demo-shots', ...paths] = process.argv.slice(2)
const base = 'http://localhost:3000'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${base}/signin`)
await page.screenshot({ path: `${out}/signin.png` })
await page.getByRole('button', { name: 'Continue as the demo clinician' }).click()
await page.getByRole('heading', { name: 'Worklist' }).waitFor()
await page.getByText('Loading…').first().waitFor({ state: 'detached', timeout: 30_000 }).catch(() => undefined)
await page.screenshot({ path: `${out}/worklist.png`, fullPage: true })
for (const p of paths) {
  try {
  await page.goto(base + p)
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/${p.replace(/[^\w]+/g, '_')}.png`, fullPage: true })
  } catch (e) { console.error(p, (e as Error).message.split('\n')[0]) }
}
await browser.close()
