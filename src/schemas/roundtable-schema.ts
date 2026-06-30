/**
 * Roundtable collections.
 *
 *  - `rooms`     — one row per Roundtable (the directory, lives in the
 *                  app scope `app:<APP_NAME>`). The host is the creator;
 *                  `hostId` is userBound so it always equals the verified
 *                  creator and can't be spoofed.
 *  - `messages`  — the conversation. These live in a PER-ROOM DO scope
 *                  (`rt:<roomId>`) so every Roundtable is its own Durable
 *                  Object room. A message with `parentId === ''` is on the
 *                  main line; a non-empty `parentId` is the id of the AI
 *                  message it branched off into a side thread.
 *  - `reactions` — lightweight emoji reactions, also per-room scope.
 *
 * AI messages are written by the worker relay (`/api/roundtable/ask`) via
 * the privileged app-action path, so their `content` streams in token by
 * token and every connected client sees the same record grow live.
 */

import type { CollectionSchema } from 'deepspace/worker'

export const roomsSchema: CollectionSchema = {
  name: 'rooms',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'code', storage: 'text', interpretation: 'plain' },
    { name: 'hostId', storage: 'text', interpretation: 'plain' },
    { name: 'hostName', storage: 'text', interpretation: 'plain' },
    { name: 'topic', storage: 'text', interpretation: 'plain' },
    // Participants the host has removed. Updated by the host (own record).
    { name: 'removedUserIds', storage: 'text', interpretation: { kind: 'json' } },
  ],
  // Everyone who reaches a room is a participant. We DON'T gate on the SDK's
  // member/viewer role: on a fresh per-room DO an authenticated caller's role
  // hasn't resolved yet and falls back to '*', so '*' must allow participation
  // or no one can write. Host-only powers (rename / clear / remove) are
  // enforced by `'own'` (host = record creator) + the worker's hostId checks,
  // not by role — so this stays correct. The room UI itself is sign-in gated.
  permissions: {
    '*': { read: true, create: true, update: 'own', delete: 'own' },
    viewer: { read: true, create: true, update: 'own', delete: 'own' },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const messagesSchema: CollectionSchema = {
  name: 'messages',
  columns: [
    // '' = main line, otherwise the id of the AI message this thread hangs off.
    { name: 'parentId', storage: 'text', interpretation: 'plain' },
    { name: 'authorId', storage: 'text', interpretation: 'plain' },
    { name: 'authorName', storage: 'text', interpretation: 'plain' },
    { name: 'authorImage', storage: 'text', interpretation: 'plain' },
    { name: 'senderKind', storage: 'text', interpretation: { kind: 'select', options: ['participant', 'ai'] } },
    { name: 'content', storage: 'text', interpretation: 'plain' },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['streaming', 'complete', 'error'] } },
    { name: 'model', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    '*': { read: true, create: true, update: 'own', delete: 'own' },
    viewer: { read: true, create: true, update: 'own', delete: 'own' },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

export const reactionsSchema: CollectionSchema = {
  name: 'reactions',
  columns: [
    { name: 'messageId', storage: 'text', interpretation: 'plain' },
    { name: 'emoji', storage: 'text', interpretation: 'plain' },
    { name: 'userId', storage: 'text', interpretation: 'plain' },
    { name: 'userName', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    '*': { read: true, create: true, update: false, delete: 'own' },
    viewer: { read: true, create: true, update: false, delete: 'own' },
    member: { read: true, create: true, update: false, delete: 'own' },
    admin: { read: true, create: true, update: false, delete: true },
  },
}
