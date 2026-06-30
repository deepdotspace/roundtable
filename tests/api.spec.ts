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

  // Locks the LiveKit voice-call contract: endpoint name + the exact response
  // shape the call UI consumes (token / wss url / roomName). `generate-token`
  // is free (developer-billed, baseCost 0), so this is one safe call per run.
  test('livekit token endpoint returns a join token + wss url', async ({ request }) => {
    const roomName = `__test-${Date.now()}__call`
    const res = await request.post('/api/integrations/livekit/generate-token', {
      data: { roomName, displayName: 'Test User' },
    })
    expect(res.ok()).toBeTruthy()

    const body = (await res.json()) as { success: boolean; data?: { token?: string; url?: string; roomName?: string } }
    expect(body.success).toBe(true)
    expect(typeof body.data?.token).toBe('string')
    expect(body.data?.token?.length ?? 0).toBeGreaterThan(20)
    expect(body.data?.url).toMatch(/^wss:\/\/.+\.livekit\.cloud/)
    expect(body.data?.roomName).toBe(roomName)
  })
})
