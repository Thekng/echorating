import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('metrics search component provides accessible ARIA labels and Escape key dismissal', () => {
  const metricsSearch = read('components/metrics/metrics-search.tsx')

  // Verify input has aria-label attribute
  assert.equal(metricsSearch.includes('aria-label={placeholder}'), true)

  // Verify clear button has explicit type="button" and aria-label
  assert.equal(metricsSearch.includes('type="button"'), true)
  assert.equal(metricsSearch.includes('aria-label="Clear search input"'), true)

  // Verify Escape key handler for closing search dropdown
  assert.equal(metricsSearch.includes("e.key === 'Escape'"), true)
})
