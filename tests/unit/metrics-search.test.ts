import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('metrics search component contains accessible ARIA attributes and labels', () => {
  const metricsSearch = read('components/metrics/metrics-search.tsx')

  assert.equal(metricsSearch.includes('aria-label="Search metrics"'), true)
  assert.equal(metricsSearch.includes('aria-label="Clear search"'), true)
  assert.equal(metricsSearch.includes('role="listbox"'), true)
  assert.equal(metricsSearch.includes('role="option"'), true)
  assert.equal(metricsSearch.includes('focus-visible:ring-ring'), true)
})
