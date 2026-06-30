/**
 * Roundtable routes — server-authoritative room writes + the AI relay.
 *
 * Why server-side writes?  In production, a record written from a browser over
 * the RecordRoom WebSocket is NOT immediately readable by the worker's own
 * `stub.fetch` (the two paths converge only slowly), and a brand-new client
 * subscription's first snapshot lags for a record another user just created.
 * Server-written records, by contrast, are reliably readable by BOTH the
 * worker (for the relay) AND every client (they broadcast over the same
 * WebSocket — the pattern the SDK's own AI-chat feature uses).
 *
 * So: rooms (and host actions) are written here, on the server. Messages and
 * reactions stay client-side (optimistic, and they broadcast fine to clients
 * already subscribed to the room). The relay receives the conversation context
 * in its request body rather than reading client-written messages back.
 *
 * The AI reply itself is written here, server-side, into the room's own
 * Durable Object (`rt:<roomId>`) and streamed token-by-token — so it animates
 * in live and simultaneously on every participant's screen.
 */

import type { Hono } from 'hono'
import { streamText } from 'ai'
import { createDeepSpaceAI } from 'deepspace/worker'
import type { VerifyResult } from 'deepspace/worker'
import { SCOPE_ID } from '../constants.js'
// Type-only — stripped at runtime, so no circular import with worker.ts.
import type { Env, AppContext } from '../../worker.js'

type ResolveAuth = (req: Request, env: Env) => Promise<VerifyResult | null>

export const ROUNDTABLE_MODELS: Record<string, true> = {
  'claude-sonnet-4-6': true,
  'claude-opus-4-7': true,
  'claude-haiku-4-5': true,
}
const DEFAULT_MODEL = 'claude-sonnet-4-6'

const MAX_CONTENT = 20_000
const FLUSH_INTERVAL_MS = 65

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function genCode(): string {
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (const b of bytes) out += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]
  return out
}

interface RoomEnvelope {
  recordId: string
  data: {
    title?: string
    code?: string
    hostId?: string
    hostName?: string
    topic?: string
    removedUserIds?: string[]
    clearedAt?: string
  }
}

interface HistoryTurn { senderKind?: 'participant' | 'ai'; authorName?: string; content?: string }

function roomStub(env: Env, roomId: string): DurableObjectStub {
  return env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`rt:${roomId}`))
}
function appStub(env: Env): DurableObjectStub {
  return env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(SCOPE_ID))
}

async function execTool<T = unknown>(
  stub: DurableObjectStub,
  userId: string,
  tool: string,
  params: Record<string, unknown>,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const res = await stub.fetch(
    new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId, 'X-App-Action': 'true' },
      body: JSON.stringify({ tool, params }),
    }),
  )
  return res.json() as Promise<{ success: boolean; data?: T; error?: string }>
}

async function getRoom(env: Env, roomId: string): Promise<RoomEnvelope | null> {
  const res = await execTool<{ record: RoomEnvelope }>(
    appStub(env), env.OWNER_USER_ID, 'records.get', { collection: 'rooms', recordId: roomId },
  )
  return res.success && res.data?.record ? res.data.record : null
}

const SYSTEM_PROMPT = `You are the shared AI assistant sitting in on a live "Roundtable" — a real-time room where a GROUP of people are talking to you together, like a team in a meeting.

Key things to understand:
- Multiple different people are in this conversation. Each human message is prefixed with the speaker's name, like "Maya: what about caching?". Treat them as distinct participants.
- You are answering the whole room, not one person. When it helps, acknowledge who asked or who raised a point by name.
- Be genuinely useful for collaborative work: research, planning, drafting, brainstorming, and debugging. Think clearly and get to the point.
- Keep replies focused and well-structured. Use short paragraphs and markdown (lists, bold, code blocks) where it aids skimming. Avoid filler and excessive preamble.
- If the group is exploring a tangent in a side thread, stay on that thread's topic.

Respond to the latest turn.`

export function registerRoundtableRoutes(app: Hono<AppContext>, resolveAuth: ResolveAuth): void {
  // ---- Create a room (server-authoritative) --------------------------------
  app.post('/api/roundtable/create', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in required' }, 401)
    const body = await c.req.json<{ title?: string; topic?: string; hostName?: string }>().catch(() => ({}) as { title?: string; topic?: string; hostName?: string })
    const title = (body.title ?? '').toString().trim().slice(0, 120)
    if (!title) return c.json({ error: 'Title is required' }, 400)
    const data = {
      title,
      topic: (body.topic ?? '').toString().trim().slice(0, 200),
      code: genCode(),
      hostId: auth.userId,
      hostName: (body.hostName ?? auth.claims.name ?? 'Host').toString().slice(0, 80),
      removedUserIds: [] as string[],
      clearedAt: '',
    }
    const res = await execTool<{ recordId: string; record: RoomEnvelope }>(
      appStub(c.env), c.env.OWNER_USER_ID, 'records.create', { collection: 'rooms', data },
    )
    if (!res.success || !res.data?.recordId) return c.json({ error: 'Failed to create room' }, 500)
    return c.json({ room: { recordId: res.data.recordId, data, createdBy: auth.userId } })
  })

  // ---- Authoritative room lookup (reliable room entry) ---------------------
  app.get('/api/roundtable/room/:id', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in required' }, 401)
    const room = await getRoom(c.env, c.req.param('id'))
    if (!room) return c.json({ room: null }, 404)
    return c.json({ room })
  })

  // ---- Host: rename --------------------------------------------------------
  app.post('/api/roundtable/rename', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in required' }, 401)
    const body = await c.req.json<{ roomId?: string; title?: string }>().catch(() => ({}) as { roomId?: string; title?: string })
    const roomId = body.roomId ?? ''
    const title = (body.title ?? '').toString().trim().slice(0, 120)
    if (!roomId || !title) return c.json({ error: 'roomId and title required' }, 400)
    const room = await getRoom(c.env, roomId)
    if (!room) return c.json({ error: 'Room not found' }, 404)
    if (room.data.hostId !== auth.userId) return c.json({ error: 'Host only' }, 403)
    await execTool(appStub(c.env), c.env.OWNER_USER_ID, 'records.update', { collection: 'rooms', recordId: roomId, data: { title } })
    return c.json({ ok: true })
  })

  // ---- Host: remove a participant ------------------------------------------
  app.post('/api/roundtable/remove', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in required' }, 401)
    const body = await c.req.json<{ roomId?: string; userId?: string }>().catch(() => ({}) as { roomId?: string; userId?: string })
    const roomId = body.roomId ?? ''
    const target = body.userId ?? ''
    if (!roomId || !target) return c.json({ error: 'roomId and userId required' }, 400)
    const room = await getRoom(c.env, roomId)
    if (!room) return c.json({ error: 'Room not found' }, 404)
    if (room.data.hostId !== auth.userId) return c.json({ error: 'Host only' }, 403)
    const next = Array.from(new Set([...(room.data.removedUserIds ?? []), target]))
    await execTool(appStub(c.env), c.env.OWNER_USER_ID, 'records.update', { collection: 'rooms', recordId: roomId, data: { removedUserIds: next } })
    return c.json({ ok: true })
  })

  // ---- Host: clear the room (soft — via a timestamp on the room) -----------
  app.post('/api/roundtable/clear', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in required' }, 401)
    const body = await c.req.json<{ roomId?: string }>().catch(() => ({}) as { roomId?: string })
    const roomId = body.roomId ?? ''
    if (!roomId) return c.json({ error: 'roomId required' }, 400)
    const room = await getRoom(c.env, roomId)
    if (!room) return c.json({ error: 'Room not found' }, 404)
    if (room.data.hostId !== auth.userId) return c.json({ error: 'Host only' }, 403)
    await execTool(appStub(c.env), c.env.OWNER_USER_ID, 'records.update', { collection: 'rooms', recordId: roomId, data: { clearedAt: new Date().toISOString() } })
    return c.json({ ok: true })
  })

  // ---- The streaming AI relay ----------------------------------------------
  app.post('/api/roundtable/ask', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Sign in required' }, 401)

    const body = await c.req.json<{
      roomId?: string
      parentId?: string
      modelId?: string
      history?: HistoryTurn[]
    }>().catch(() => ({}) as { roomId?: string; parentId?: string; modelId?: string; history?: HistoryTurn[] })

    const roomId = typeof body.roomId === 'string' ? body.roomId : ''
    const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : 'main'
    const modelId = body.modelId && ROUNDTABLE_MODELS[body.modelId] ? body.modelId : DEFAULT_MODEL
    const history = Array.isArray(body.history) ? body.history : []
    if (!roomId) return c.json({ error: 'roomId is required' }, 400)

    // Build alternating turns from the client-supplied context. A multiplayer
    // room produces many consecutive human turns — coalesce them into one user
    // turn of "Name: text" lines so Claude still sees who said what.
    const turns: { role: 'user' | 'assistant'; content: string }[] = []
    for (const r of history) {
      const content = (r.content ?? '').toString().slice(0, MAX_CONTENT)
      if (!content.trim()) continue
      const role: 'user' | 'assistant' = r.senderKind === 'ai' ? 'assistant' : 'user'
      const line = role === 'assistant' ? content : `${r.authorName || 'Someone'}: ${content}`
      const last = turns[turns.length - 1]
      if (last && last.role === role) last.content += '\n' + line
      else turns.push({ role, content: line })
    }
    if (turns.length === 0 || turns[turns.length - 1].role !== 'user') {
      return c.json({ error: 'Nothing to respond to yet' }, 400)
    }

    const stub = roomStub(c.env, roomId)
    const createRes = await execTool<{ recordId: string }>(
      stub, c.env.OWNER_USER_ID, 'records.create',
      {
        collection: 'messages',
        data: {
          parentId, authorId: 'ai', authorName: 'Assistant', authorImage: '',
          senderKind: 'ai', content: '', status: 'streaming', model: modelId,
        },
      },
    )
    if (!createRes.success || !createRes.data?.recordId) {
      console.error('[roundtable] failed to create AI message', createRes.error)
      return c.json({ error: 'Failed to start reply' }, 500)
    }
    const messageId = createRes.data.recordId

    const run = async () => {
      let full = ''
      let lastFlush = 0
      let lastWritten = ''
      const flush = async (force: boolean) => {
        const now = Date.now()
        if (!force && now - lastFlush < FLUSH_INTERVAL_MS) return
        if (full === lastWritten) return
        lastFlush = now
        lastWritten = full
        await execTool(stub, c.env.OWNER_USER_ID, 'records.update', {
          collection: 'messages', recordId: messageId, data: { content: full },
        }).catch(() => {})
      }
      try {
        const ai = createDeepSpaceAI(c.env, 'anthropic') // owner-billed
        const result = streamText({ model: ai(modelId), system: SYSTEM_PROMPT, messages: turns })
        for await (const delta of result.textStream) {
          full += delta
          if (full.length > MAX_CONTENT) full = full.slice(0, MAX_CONTENT)
          await flush(false)
        }
        await execTool(stub, c.env.OWNER_USER_ID, 'records.update', {
          collection: 'messages', recordId: messageId,
          data: { content: full || '_(no response)_', status: 'complete' },
        })
      } catch (err) {
        console.error('[roundtable] stream error', err)
        await execTool(stub, c.env.OWNER_USER_ID, 'records.update', {
          collection: 'messages', recordId: messageId,
          data: { content: (full ? full + '\n\n' : '') + '_The assistant hit an error. Try again._', status: 'error' },
        }).catch(() => {})
      }
    }
    c.executionCtx.waitUntil(run())
    return c.json({ ok: true, messageId })
  })
}
