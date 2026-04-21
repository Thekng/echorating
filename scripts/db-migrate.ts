// Applies every .sql file in lib/db/migrations/ in lexicographic order against
// the database pointed at by $DATABASE_URL. Tracks applied migrations in a
// `schema_migrations` table so reruns are idempotent.
//
// Modes (argv[2]):
//   apply (default) — apply any pending migrations
//   check           — exit 1 if any migrations are pending; print the list

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync, spawnSync } from 'node:child_process'

const MIGRATIONS_DIR = resolve(process.cwd(), 'lib/db/migrations')

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }
  return url
}

function listMigrationFiles(): string[] {
  const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort()
}

function runPsql(databaseUrl: string, args: string[], input?: string) {
  const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', ...args], {
    input,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? ''
    throw new Error(`psql exited with ${result.status}${stderr ? `: ${stderr}` : ''}`)
  }
  return result.stdout
}

function ensureSchemaMigrationsTable(databaseUrl: string) {
  runPsql(
    databaseUrl,
    ['-c', `create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());`],
  )
}

function fetchAppliedMigrations(databaseUrl: string): Set<string> {
  const out = runPsql(databaseUrl, [
    '-At',
    '-c',
    'select name from public.schema_migrations order by name;',
  ])
  return new Set(out.split('\n').map((s) => s.trim()).filter(Boolean))
}

function applyMigration(databaseUrl: string, file: string) {
  const path = join(MIGRATIONS_DIR, file)
  const sql = readFileSync(path, 'utf8')
  const recordStmt = `insert into public.schema_migrations (name) values ('${file.replace(/'/g, "''")}');`
  // One transaction per migration file — either the file applies in full and is
  // recorded, or nothing persists.
  const wrapped = `begin;\n${sql}\n${recordStmt}\ncommit;\n`
  runPsql(databaseUrl, [], wrapped)
}

function check() {
  const databaseUrl = requireDatabaseUrl()
  ensurePsqlAvailable()
  ensureSchemaMigrationsTable(databaseUrl)
  const applied = fetchAppliedMigrations(databaseUrl)
  const files = listMigrationFiles()
  const pending = files.filter((f) => !applied.has(f))
  if (pending.length === 0) {
    console.log(`schema is current; ${files.length} migrations applied.`)
    return
  }
  console.error(`schema drift: ${pending.length} pending migration(s):`)
  for (const f of pending) console.error(`  - ${f}`)
  process.exit(1)
}

function apply() {
  const databaseUrl = requireDatabaseUrl()
  ensurePsqlAvailable()
  ensureSchemaMigrationsTable(databaseUrl)
  const applied = fetchAppliedMigrations(databaseUrl)
  const files = listMigrationFiles()
  const pending = files.filter((f) => !applied.has(f))
  if (pending.length === 0) {
    console.log(`no pending migrations; ${files.length} already applied.`)
    return
  }
  console.log(`applying ${pending.length} pending migration(s)...`)
  for (const file of pending) {
    process.stdout.write(`  ${file} ... `)
    try {
      applyMigration(databaseUrl, file)
      console.log('ok')
    } catch (err) {
      console.error('FAILED')
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  }
  console.log(`applied ${pending.length} migration(s).`)
}

function ensurePsqlAvailable() {
  try {
    execSync('psql --version', { stdio: 'ignore' })
  } catch {
    console.error('psql is not available on PATH. Install PostgreSQL client tools.')
    process.exit(1)
  }
}

const mode = process.argv[2] ?? 'apply'
if (mode === 'apply') {
  apply()
} else if (mode === 'check') {
  check()
} else {
  console.error(`unknown mode: ${mode}. Use 'apply' or 'check'.`)
  process.exit(1)
}
