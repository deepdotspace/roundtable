/**
 * Roundtable multiplayer e2e — the core promise:
 * when one participant asks the AI, the streamed reply appears for
 * EVERYONE in the room, live.
 *
 * Uses two signed-in browser contexts (host + participant) sharing one
 * room DO. Exactly ONE real AI call is made (owner-billed) per run — keep
 * it that way; integration calls cost money.
 */
import { test, expect, type MultiplayerUser } from 'deepspace/testing'
import type { Page } from '@playwright/test'

async function createRoom(host: MultiplayerUser, name: string): Promise<string> {
  await host.page.goto('/home')
  await expect(host.page.getByTestId('app-navigation')).toBeVisible({ timeout: 15_000 })
  await host.page.getByRole('button', { name: 'New roundtable' }).first().click()
  const dialog = host.page.getByRole('dialog')
  await dialog.getByPlaceholder(/Q3 planning/).fill(name)
  await dialog.getByRole('button', { name: /Create/ }).click()
  await host.page.waitForURL(/\/r\/.+/, { timeout: 15_000 })
  return host.page.url()
}

// The composer is disabled until this client's room DO scope is synced.
// Waiting on it is the reliable "room is live for me" signal.
function composer(page: Page) {
  return page.getByPlaceholder(/Message the roundtable/)
}
async function waitRoomLive(page: Page) {
  await expect(composer(page)).toBeEnabled({ timeout: 30_000 })
}

test('AI reply streams into the shared room for every participant', async ({ users }) => {
  test.setTimeout(90_000)
  const [host, guest] = await users(['Quill A', 'Quill B'])

  const roomUrl = await createRoom(host, 'E2E Live Room')
  await guest.page.goto(roomUrl)

  // Both clients are live in the same room.
  await waitRoomLive(host.page)
  await waitRoomLive(guest.page)

  // Presence converges on 2 people on both screens.
  await expect.poll(() => host.page.getByTestId('participant-count').textContent(), { timeout: 30_000 }).toBe('2')
  await expect.poll(() => guest.page.getByTestId('participant-count').textContent(), { timeout: 30_000 }).toBe('2')

  // Host asks the AI for a deterministic token.
  await composer(host.page).fill('Reply with exactly the token PONG-42 and nothing else.')
  await host.page.getByRole('button', { name: 'Ask AI' }).click()

  // The host's participant message broadcasts to the guest.
  await expect(
    guest.page.locator('[data-sender="participant"]').filter({ hasText: 'PONG-42' }),
  ).toBeVisible({ timeout: 20_000 })

  // The AI reply must appear AND complete on BOTH screens.
  for (const u of [host, guest]) {
    const ai = u.page.locator('[data-sender="ai"]')
    await expect(ai.first()).toBeVisible({ timeout: 40_000 })
    await expect(ai.first()).toContainText('PONG', { timeout: 40_000 })
    await expect(u.page.locator('[data-sender="ai"][data-status="complete"]').first())
      .toBeVisible({ timeout: 40_000 })
  }
})

test('emoji reactions sync live between participants', async ({ users }) => {
  test.setTimeout(90_000)
  const [host, guest] = await users(['Quill A', 'Quill B'])

  const roomUrl = await createRoom(host, 'E2E Reactions')
  await guest.page.goto(roomUrl)
  await waitRoomLive(host.page)
  await waitRoomLive(guest.page)

  // Host posts WITHOUT calling the AI (no integration cost).
  await composer(host.page).fill('A point worth a reaction')
  await host.page.getByRole('button', { name: 'Just post' }).click()

  const guestMsg = guest.page.locator('[data-sender="participant"]').filter({ hasText: 'A point worth a reaction' })
  await expect(guestMsg).toBeVisible({ timeout: 20_000 })

  // Host reacts via the hover toolbar.
  const hostMsg = host.page.locator('[data-sender="participant"]').filter({ hasText: 'A point worth a reaction' })
  await hostMsg.hover()
  await hostMsg.getByTitle('React').click()
  await host.page.getByRole('button', { name: '🎉' }).click()

  // Guest sees the reaction chip appear live.
  await expect(guestMsg.getByText('🎉')).toBeVisible({ timeout: 20_000 })
})
