import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { FORBIDDEN, SYN, fillLogin, renderedHtml, signIn } from './helpers'

test.describe.configure({ mode: 'serial' })

async function decide(page: Page, parameter: string, action: 'Accept' | 'Override') {
  await page.getByRole('group', { name: `Decision on ${parameter}` }).getByLabel(action).check()
}

test('sign-in: protected pages redirect, a wrong code is refused, the worklist lists pending approvals first', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/signin/)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await fillLogin(page, '000000')
  await expect(page.getByRole('alert')).toContainText('Wrong user name, password or code')
  await fillLogin(page)
  await expect(page.getByRole('heading', { name: 'Worklist' })).toBeVisible()
  const rows = page.getByRole('row')
  await expect(rows.nth(1)).toContainText('Pending approval')
  await expect(rows.nth(2)).toContainText('Pending approval')
  await expect(page.getByRole('row', { name: /SYN-04/ })).toContainText('Expired')
})

test('reviewing a suggestion: simulated values, two reasons, clamp note, warnings after pain or STOP', async ({ page }) => {
  await signIn(page)
  await page.getByRole('link', { name: 'SYN-03' }).click()
  await expect(page.getByRole('heading', { name: 'Next session plan' })).toBeVisible()
  const ceiling = page.getByRole('row', { name: /Intensity ceiling/ })
  await expect(ceiling).toContainText('simulated')
  await expect(ceiling.getByRole('listitem')).toHaveCount(2)
  await expect(ceiling).toContainText('Clamped by rule')
  await expect(page.getByRole('row', { name: /Frequency/ }).or(page.getByText('50 Hz'))).toBeVisible()
  const approve = page.getByRole('button', { name: 'Review and approve' })
  await expect(approve).toBeDisabled()
  for (const p of ['Intensity ceiling', 'OFF time between contractions', 'Contractions per session']) await decide(page, p, 'Accept')
  await approve.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('alert')).toContainText('pain 6/10')
  await expect(dialog.getByRole('alert')).toContainText('STOP press')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('a value outside the limits blocks the approval', async ({ page }) => {
  await signIn(page)
  await page.goto(`/patients/${SYN['SYN-03']}`)
  await decide(page, 'Intensity ceiling', 'Override')
  await page.getByRole('spinbutton', { name: /New value/ }).fill('55')
  await page.getByLabel(/Reason/).first().fill('Testing a value above the cap')
  await decide(page, 'OFF time between contractions', 'Accept')
  await decide(page, 'Contractions per session', 'Accept')
  await expect(page.getByText('Enter a whole number from 10 to 50 mA.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review and approve' })).toBeDisabled()
})

test('accept two values, override one with a reason, approve after step-up', async ({ page }) => {
  await signIn(page)
  await page.request.post('/api/dev/session-age?seconds=600') // the sign-in is now 10 minutes old
  await page.goto(`/patients/${SYN['SYN-04']}`)
  await decide(page, 'Intensity ceiling', 'Accept')
  await decide(page, 'Contractions per session', 'Accept')
  await decide(page, 'OFF time between contractions', 'Override')
  const approve = page.getByRole('button', { name: 'Review and approve' })
  await page.getByRole('combobox', { name: /New value/ }).selectOption('90')
  await expect(approve).toBeDisabled() // reason still missing
  await page.getByLabel(/Reason/).fill('Longer rest after two missed days')
  await approve.click()
  await page.getByRole('dialog').getByRole('button', { name: /Approve plan version/ }).click()

  await expect(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible() // step-up
  await fillLogin(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('You signed in again')
  await expect(dialog).toContainText('90 s')
  await dialog.getByRole('button', { name: /Approve plan version/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /Plan version \d+ approved/ })).toBeVisible()

  await page.getByRole('link', { name: 'Decision log' }).click()
  await expect(page.getByRole('row', { name: /Longer rest after two missed days/ })).toContainText('Overridden')
})

test('session timeout: 15 minutes without activity signs the clinician out', async ({ page }) => {
  await page.clock.install()
  await signIn(page)
  await expect(page.getByRole('row', { name: /SYN-01/ })).toBeVisible() // data loaded: the app has hydrated and the idle timer runs
  await page.clock.fastForward('15:01')
  await expect(page).toHaveURL(/\/signin\?reason=idle/)
  await expect(page.getByRole('status')).toContainText('15 minutes without activity')
  await page.goto('/')
  await expect(page).toHaveURL(/\/signin/)
})

const PAGES = ['/', `/patients/${SYN['SYN-03']}`, `/patients/${SYN['SYN-02']}/sessions`, `/patients/${SYN['SYN-02']}/safety`,
  `/patients/${SYN['SYN-01']}/charts`, `/patients/${SYN['SYN-04']}/decisions`, `/patients/${SYN['SYN-01']}/audit`, '/bench']

test('no serious accessibility violations (axe), no forbidden words and the prototype banner on every page', async ({ page }) => {
  await page.goto('/signin')
  for (const target of [page]) {
    const scan = async (name: string) => {
      const r = await new AxeBuilder({ page: target }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map((v) => `${name}: ${v.id} (${v.nodes.length})`)).toEqual([])
      expect((await renderedHtml(target)).match(FORBIDDEN)?.[0], name).toBeUndefined()
      await expect(target.getByRole('complementary', { name: 'Research prototype notice' }), name).toHaveText('Research prototype. Not a medical device. Stimulation into a dummy load only.')
    }
    await scan('/signin')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await scan('/dev-login')
    await fillLogin(page)
    for (const url of PAGES) {
      await page.goto(url)
      await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible()
      await page.waitForLoadState('networkidle')
      await scan(url)
    }
  }
})

test('screenshots of the next-session panel at desktop and tablet widths', async ({ page }) => {
  await signIn(page)
  await page.goto(`/patients/${SYN['SYN-03']}`)
  await decide(page, 'Intensity ceiling', 'Accept')
  await decide(page, 'OFF time between contractions', 'Override')
  await page.getByRole('combobox', { name: /New value/ }).selectOption('60')
  await page.getByLabel(/Reason/).fill('Keep a longer rest after the STOP press')
  for (const [name, size] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 834, height: 1194 }]] as const) {
    await page.setViewportSize(size)
    await page.screenshot({ path: `../../docs/screenshots/next-session-${name}.png`, fullPage: true })
  }
})
