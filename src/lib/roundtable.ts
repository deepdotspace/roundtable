/**
 * Shared types + client helpers for Roundtable.
 */
import { getAuthToken, integration } from 'deepspace'

export interface RoomData {
  title: string
  code: string
  hostId: string
  hostName: string
  topic: string
  removedUserIds: string[]
  /** ISO timestamp; messages created at/before this are hidden ("cleared"). */
  clearedAt?: string
}

export interface MessageData {
  parentId: string
  authorId: string
  authorName: string
  authorImage: string
  senderKind: 'participant' | 'ai'
  content: string
  status: 'streaming' | 'complete' | 'error'
  model: string
}

export interface ReactionData {
  messageId: string
  emoji: string
  userId: string
  userName: string
}

/** Generic record envelope returned by useQuery. */
export interface Envelope<T> {
  recordId: string
  data: T
  createdBy: string
  createdAt: number
  updatedAt: number
}

export const MODELS: { id: string; label: string }[] = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet' },
  { id: 'claude-opus-4-7', label: 'Claude Opus' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku' },
]

export const REACTION_EMOJIS = ['👍', '❤️', '🎉', '🤔', '🚀', '👀'] as const

/**
 * Sentinel for the main conversation line. Empty strings get normalized
 * away by the text-column storage layer, so we use a non-empty marker;
 * a thread message's `parentId` is the id of the AI message it branches off.
 */
export const MAIN_THREAD = 'main'

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function generateRoomCode(): string {
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (const b of bytes) out += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]
  return out
}

async function authedPost(path: string, body: unknown): Promise<Response> {
  const token = await getAuthToken()
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

export interface AskHistoryTurn {
  senderKind: 'participant' | 'ai'
  authorName: string
  content: string
}

/** Trigger an AI reply that streams into the shared room for everyone. */
export async function askAI(opts: {
  roomId: string
  parentId?: string
  modelId?: string
  history: AskHistoryTurn[]
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const res = await authedPost('/api/roundtable/ask', {
    roomId: opts.roomId,
    parentId: opts.parentId ?? MAIN_THREAD,
    modelId: opts.modelId,
    history: opts.history,
  })
  return res.json().then((j) => j as { ok: boolean; messageId?: string; error?: string })
    .catch(() => ({ ok: false, error: 'Request failed' }))
}

/** Create a room server-side (reliable cross-client). Returns the new room. */
export async function createRoom(input: { title: string; topic?: string; hostName?: string }): Promise<Envelope<RoomData> | null> {
  const res = await authedPost('/api/roundtable/create', input)
  if (!res.ok) return null
  const json = (await res.json().catch(() => ({}))) as { room?: Envelope<RoomData> }
  return json.room ?? null
}

/** Host: rename the room. */
export async function renameRoom(roomId: string, title: string): Promise<boolean> {
  const res = await authedPost('/api/roundtable/rename', { roomId, title })
  return res.ok
}

/** Host: remove a participant. */
export async function removeParticipant(roomId: string, userId: string): Promise<boolean> {
  const res = await authedPost('/api/roundtable/remove', { roomId, userId })
  return res.ok
}

/**
 * Authoritative server-side room lookup — reliable for room entry even right
 * after another user created it (client query snapshots can lag on first sync).
 */
export async function fetchRoom(id: string): Promise<Envelope<RoomData> | null> {
  const token = await getAuthToken()
  try {
    const res = await fetch(`/api/roundtable/room/${encodeURIComponent(id)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    const json = (await res.json()) as { room?: Envelope<RoomData> | null }
    return json.room ?? null
  } catch {
    return null
  }
}

/** Host-only: clear the room (hides all messages up to now for everyone). */
export async function clearRoom(roomId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await authedPost('/api/roundtable/clear', { roomId })
  return res.json().then((j) => j as { ok: boolean; error?: string })
    .catch(() => ({ ok: false, error: 'Request failed' }))
}

// ---- Voice call (LiveKit) ------------------------------------------------

export interface CallCredentials {
  token: string
  url: string
  roomName: string
}

/** Stable, namespaced LiveKit room name for a Roundtable. */
export function callRoomName(roomId: string): string {
  return `rt-${roomId}`
}

/**
 * Mint a LiveKit access token for this room's voice call. Uses the free,
 * auto-creating `livekit/generate-token` endpoint — the LiveKit room
 * materializes on first connect and disposes when empty. The calling page is
 * already auth-gated (`(protected)`), so only signed-in users can mint one.
 */
export async function mintCallToken(roomId: string, displayName: string): Promise<CallCredentials | null> {
  const res = await integration.post<CallCredentials>('livekit/generate-token', {
    roomName: callRoomName(roomId),
    displayName,
  })
  if (!res?.success || !res.data?.token) return null
  return res.data
}
