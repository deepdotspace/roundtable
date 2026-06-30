/**
 * Roundtable multiplayer e2e — the core promise:
 * when one participant asks, the streamed reply appears for EVERYONE, live.
 *
 * Two signed-in browser contexts (host + guest) share one room DO. Exactly
 * ONE real model call is made per run — keep it that way; it costs money.
 */
import { test, expect, type MultiplayerUser } from 'deepspace/testing'
import type { Page } from '@playwright/test'

async function createRoom(host: MultiplayerUser, name: string): Promise<string> {
  await host.page.goto('/home')
  await expect(host.page.getByTestId('app-root')).toBeVisible({ timeout: 15_000 })
  await host.page.getByPlaceholder(/Name a new room/).fill(name)
  await host.page.getByRole('button', { name: 'Create' }).click()
  await host.page.waitForURL(/\/r\/.+/, { timeout: 15_000 })
  return host.page.url()
}

function composer(page: Page) {
  return page.getByPlaceholder(/Message the room/)
}
// The composer is disabled until this client's room DO scope is synced —
// the reliable "room is live for me" signal.
async function waitRoomLive(page: Page) {
  await expect(composer(page)).toBeEnabled({ timeout: 30_000 })
}

test('a reply streams into the shared room for every participant', async ({ users }) => {
  test.setTimeout(90_000)
  const [host, guest] = await users(['Quill A', 'Quill B'])

  const roomUrl = await createRoom(host, 'E2E Live Room')
  await guest.page.goto(roomUrl)

  await waitRoomLive(host.page)
  await waitRoomLive(guest.page)

  // Presence converges on 2 on both screens.
  await expect.poll(() => host.page.getByTestId('participant-count').textContent(), { timeout: 30_000 }).toBe('2')
  await expect.poll(() => guest.page.getByTestId('participant-count').textContent(), { timeout: 30_000 }).toBe('2')

  // Host asks for a deterministic token.
  await composer(host.page).fill('Reply with exactly the token PONG-42 and nothing else.')
  await host.page.getByRole('button', { name: 'Ask' }).click()

  // The host's message broadcasts to the guest.
  await expect(
    guest.page.locator('[data-sender="participant"]').filter({ hasText: 'PONG-42' }),
  ).toBeVisible({ timeout: 20_000 })

  // The reply must appear AND complete on BOTH screens.
  for (const u of [host, guest]) {
    const ai = u.page.locator('[data-sender="ai"]')
    await expect(ai.first()).toBeVisible({ timeout: 40_000 })
    await expect(ai.first()).toContainText('PONG', { timeout: 40_000 })
    await expect(u.page.locator('[data-sender="ai"][data-status="complete"]').first()).toBeVisible({ timeout: 40_000 })
  }
})

test('a participant can join the voice call and others see it live', async ({ users }) => {
  test.setTimeout(90_000)
  const [host, guest] = await users(['Quill A', 'Quill B'])

  const roomUrl = await createRoom(host, 'E2E Voice Call')
  await guest.page.goto(roomUrl)
  await waitRoomLive(host.page)
  await waitRoomLive(guest.page)

  // The "Join call" control renders in the header for everyone in the room.
  await expect(host.page.getByTestId('join-call')).toBeVisible({ timeout: 15_000 })
  await expect(guest.page.getByTestId('join-call')).toBeVisible({ timeout: 15_000 })
  // Nobody is on the call yet, so no other-participant count badge.
  await expect(guest.page.getByTestId('call-others-count')).toHaveCount(0)

  // Host joins — this mints a real LiveKit token and connects over WebRTC
  // (fake mic via launch flags). The header flips to the active call strip.
  await host.page.getByTestId('join-call').click()
  await expect(host.page.getByTestId('call-active')).toBeVisible({ timeout: 45_000 })

  // The host's on-call state broadcasts through presence, so the guest — who
  // has NOT joined — sees the live "1 other on the call" badge.
  await expect.poll(
    () => guest.page.getByTestId('call-others-count').textContent(),
    { timeout: 30_000, intervals: [500] },
  ).toBe('1')

  // Guest joins too. Both must stay on the call — this guards the regression
  // where a shared LiveKit identity made the second joiner evict the first.
  await guest.page.getByTestId('join-call').click()
  await expect(guest.page.getByTestId('call-active')).toBeVisible({ timeout: 45_000 })

  // Each side sees BOTH participants (self + the other), and crucially the host
  // is NOT evicted: its call strip stays up and shows two avatars.
  await expect.poll(
    () => host.page.getByTestId('call-participant').count(),
    { timeout: 30_000, intervals: [500] },
  ).toBe(2)
  await expect.poll(
    () => guest.page.getByTestId('call-participant').count(),
    { timeout: 30_000, intervals: [500] },
  ).toBe(2)
  // The host never fell back to the "Join call" button (i.e. wasn't kicked).
  await expect(host.page.getByTestId('call-active')).toBeVisible()
  await expect(host.page.getByTestId('join-call')).toHaveCount(0)

  // Host leaves; the guest is left alone on the call (one avatar) and still in it.
  await host.page.getByTitle('Leave call').click()
  await expect(host.page.getByTestId('join-call')).toBeVisible({ timeout: 15_000 })
  await expect.poll(
    () => guest.page.getByTestId('call-participant').count(),
    { timeout: 30_000, intervals: [500] },
  ).toBe(1)
  await expect(guest.page.getByTestId('call-active')).toBeVisible()
})

test('emoji reactions sync live between participants', async ({ users }) => {
  test.setTimeout(90_000)
  const [host, guest] = await users(['Quill A', 'Quill B'])

  const roomUrl = await createRoom(host, 'E2E Reactions')
  await guest.page.goto(roomUrl)
  await waitRoomLive(host.page)
  await waitRoomLive(guest.page)

  // Host posts without a reply (no model cost).
  await composer(host.page).fill('A point worth a reaction')
  await host.page.getByRole('button', { name: 'Send' }).click()

  const guestMsg = guest.page.locator('[data-sender="participant"]').filter({ hasText: 'A point worth a reaction' })
  await expect(guestMsg).toBeVisible({ timeout: 20_000 })

  // Host reacts via the hover toolbar.
  const hostMsg = host.page.locator('[data-sender="participant"]').filter({ hasText: 'A point worth a reaction' })
  await hostMsg.hover()
  await hostMsg.getByTitle('React').click()
  await host.page.getByRole('button', { name: '🎉' }).click()

  await expect(guestMsg.getByText('🎉')).toBeVisible({ timeout: 20_000 })
})
