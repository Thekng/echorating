import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('MetricsSearch includes accessibility attributes and explicit button types', () => {
  const content = read('components/metrics/metrics-search.tsx')

  assert.ok(content.includes('aria-label="Search metrics"'), 'Search input must have aria-label')
  assert.ok(content.includes('aria-label="Clear search"'), 'Clear button must have aria-label')
  assert.ok(content.includes('type="button"'), 'Interactive buttons must explicitly specify type="button"')
})
