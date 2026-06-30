/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { roomsSchema, messagesSchema, reactionsSchema } from './schemas/roundtable-schema'

/**
 * Full set — baked into every RecordRoom DO at deploy time (worker.ts).
 */
export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  roomsSchema,
  messagesSchema,
  reactionsSchema,
]

/**
 * Client-side scope subsets. Each collection name must map to exactly ONE
 * mounted RecordScope or the hooks can't tell which DO to read/write — so
 * the app scope (`app:<APP_NAME>`) owns the room directory, and each
 * per-room scope (`rt:<id>`) owns that room's conversation. The DO still
 * has every schema baked in; these just scope the client registries.
 */
export const appSchemas: CollectionSchema[] = [usersSchema, settingsSchema, roomsSchema]
export const roomSchemas: CollectionSchema[] = [messagesSchema, reactionsSchema]
