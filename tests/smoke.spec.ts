import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/** The app shell mounts this once auth resolves. */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('app loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Roundtable', level: 1 })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('landing shows the Roundtable brand + sign-in, not scaffold placeholders', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page).toHaveTitle(/Roundtable/)
    await expect(page.getByRole('heading', { name: 'Roundtable', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in to start/ })).toBeVisible()
    await expect(page.getByText('Your DeepSpace app is running.')).toHaveCount(0)
    await expect(page.getByText('docs.deep.space')).toHaveCount(0)
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
