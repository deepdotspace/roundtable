import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Wait for the React app to mount. The app shows either:
 * - "Loading..." while auth initializes
 * - The navigation bar once ready
 */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('app loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    expect(errors).toEqual([])
  })

  test('navigation is visible', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('app-navigation')).toBeVisible()
  })

  test('sign-in button visible when logged out', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible()
    await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
  })

  test('landing shows the Roundtable brand, not scaffold placeholders', async ({ page }) => {
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
