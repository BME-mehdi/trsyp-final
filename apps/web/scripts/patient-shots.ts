// Screenshots of the patient app's web build in demo mode (EXPO_PUBLIC_DEMO=1 npx expo start --web --port 8081).
// Usage: npx tsx scripts/patient-shots.ts <out-dir> [route ...]
import { chromium } from '@playwright/test'

const [out = 'patient-shots', ...routes] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: Number(process.env.H ?? 860) }, deviceScaleFactor: 2 })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message.split('\n')[0] ?? ''))
for (const r of routes.length ? routes : ['/']) {
  await page.goto(`http://localhost:8081${r}`, { waitUntil: 'networkidle', timeout: 180_000 }).catch((e: Error) => errors.push(`${r}: ${e.message.split('\n')[0]}`))
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${out}/p${r.replace(/[^\w]+/g, '_')}.png`, fullPage: true })
}
console.log(errors.length ? errors.join('\n') : 'no page errors')
await browser.close()
