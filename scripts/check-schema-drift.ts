// Fails CI if any runtime "legacy column" fallback helpers exist in features/.
//
// The codebase previously coped with missing columns at request time
// (isMissingMetricsSortOrderColumn, requiresLegacyMetricColumns, etc.).
// Those patterns hide schema drift — if a migration was missed in prod, the
// code silently took a different path instead of failing loudly.
//
// One enforced migration process replaces those fallbacks. This check exists
// to keep new fallbacks from being reintroduced.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.cwd(), 'features')

const FORBIDDEN_PATTERNS = [
  /isMissing\w*Column\b/,
  /requiresLegacy\w+/,
  /column\s+\w+(?:\.\w+)?\s+does\s+not\s+exist/i,
]

const IGNORED_FILES = [
  'features/daily-log/calculated-recompute.ts',
]

type Hit = { file: string; line: number; text: string }

function walk(dir: string, hits: Hit[]) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = full.replace(`${process.cwd()}/`, '')
    if (IGNORED_FILES.some((ignored) => rel.endsWith(ignored))) {
      continue
    }
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, hits)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    const source = readFileSync(full, 'utf8')
    const lines = source.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i]
      for (const re of FORBIDDEN_PATTERNS) {
        if (re.test(text)) {
          hits.push({ file: full, line: i + 1, text: text.trim() })
          break
        }
      }
    }
  }
}

const hits: Hit[] = []
walk(ROOT, hits)

if (hits.length === 0) {
  console.log('no schema-drift fallbacks detected.')
  process.exit(0)
}

console.error(
  `found ${hits.length} schema-drift fallback reference(s). Remove them and ensure migrations are applied:`,
)
for (const h of hits) {
  const rel = h.file.replace(`${process.cwd()}/`, '')
  console.error(`  ${rel}:${h.line}: ${h.text}`)
}
process.exit(1)
