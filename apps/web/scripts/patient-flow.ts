// Drives the patient demo through the rating flow and captures each step (demo web build on :8081).
import { chromium } from '@playwright/test'

const out = process.argv[2] ?? 'patient-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message.split('\n')[0] ?? ''))
const shot = async (name: string) => { await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/flow-${name}.png` }) }
await page.goto('http://localhost:8081/', { waitUntil: 'networkidle', timeout: 180_000 })
await page.getByText('Rate your last session').click()
await page.getByTestId('comfort-2').click()
await page.getByText('Higher').click()
await page.getByText('Higher').click()
await shot('rating')
await page.getByTestId('submit').click()
await shot('celebration')
await page.getByText('Continue').click()
await shot('today-after')
await page.setViewportSize({ width: 400, height: 3200 })
await page.goto('http://localhost:8081/progress', { waitUntil: 'networkidle' })
await shot('progress-full')
await page.setViewportSize({ width: 400, height: 1400 })
await page.goto('http://localhost:8081/emergency', { waitUntil: 'networkidle' })
await shot('emergency')
console.log(errors.length ? errors.join('\n') : 'no page errors')
await browser.close()
