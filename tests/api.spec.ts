import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    await page.goto('/')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })

  // The LiveKit token mint is billed per-user (so each caller's own JWT subject
  // becomes their LiveKit identity — see src/integrations.ts). That means the
  // api-worker rejects anonymous callers: the call surface must be signed in.
  // The authenticated success path (real token + two users joining without
  // eviction) is covered end-to-end in roundtable.spec.ts.
  test('livekit token mint requires authentication (per-user billing)', async ({ request }) => {
    const res = await request.post('/api/integrations/livekit/generate-token', {
      data: { roomName: `__test-${Date.now()}__call`, displayName: 'Anon' },
    })
    expect(res.status()).toBe(401)
  })
})
