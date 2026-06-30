/** App name — replaced by the CLI during scaffolding */
export const APP_NAME = 'roundtable'

/**
 * Primary scope ID for the app's RecordRoom DO (the room directory).
 * Shared with the worker relay so both target the same DO instance.
 */
export const SCOPE_ID = `app:${APP_NAME}`

/** Roles and display config — imported from SDK (single source of truth) */
export { ROLES, ROLE_CONFIG, type Role } from 'deepspace'
