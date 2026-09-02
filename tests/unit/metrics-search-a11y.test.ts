import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('MetricsSearch includes clear search ARIA attributes, input label, and status role', () => {
  const code = read('components/metrics/metrics-search.tsx')

  assert.equal(code.includes('aria-label="Search metrics"'), true)
  assert.equal(code.includes('aria-label="Clear search"'), true)
  assert.equal(code.includes('type="button"'), true)
  assert.equal(code.includes('role="status"'), true)
  assert.equal(code.includes('focus-visible:ring-2'), true)
})
