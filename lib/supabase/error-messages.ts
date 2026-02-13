const RECURSIVE_RLS_MESSAGE = 'stack depth limit exceeded'
const RECURSIVE_RLS_HINT =
  'Database RLS recursion detected. Run migration: lib/db/migrations/2026-02-13_fix_recursive_rls_helpers.sql'

export function formatDatabaseError(message: string) {
  if (message.toLowerCase().includes(RECURSIVE_RLS_MESSAGE)) {
    return RECURSIVE_RLS_HINT
  }

  return message
}
