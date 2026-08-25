import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('metrics search component implements accessibility ARIA roles and labels', () => {
  const metricsSearch = read('components/metrics/metrics-search.tsx')

  assert.equal(metricsSearch.includes('role="combobox"'), true)
  assert.equal(metricsSearch.includes('aria-expanded={isOpen}'), true)
  assert.equal(metricsSearch.includes('aria-controls="metrics-search-listbox"'), true)
  assert.equal(metricsSearch.includes('aria-label="Clear search query"'), true)
  assert.equal(metricsSearch.includes('role="listbox"'), true)
  assert.equal(metricsSearch.includes('role="option"'), true)
})
