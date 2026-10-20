import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('MetricsSearch includes clear button aria-label and option role/aria-selected', () => {
  const metricsSearch = read('components/metrics/metrics-search.tsx')

  assert.equal(metricsSearch.includes('aria-label="Clear search"'), true)
  assert.equal(metricsSearch.includes('role="listbox"'), true)
  assert.equal(metricsSearch.includes('role="option"'), true)
  assert.equal(metricsSearch.includes('aria-selected={false}'), true)
})
