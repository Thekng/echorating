import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('MetricsSearch includes accessibility attributes and keyboard search handler', () => {
  const metricsSearchContent = read('components/metrics/metrics-search.tsx')

  assert.equal(metricsSearchContent.includes('aria-label={placeholder}'), true)
  assert.equal(metricsSearchContent.includes('aria-label="Clear search query"'), true)
  assert.equal(metricsSearchContent.includes('title="Clear search"'), true)
  assert.equal(metricsSearchContent.includes('type="button"'), true)
  assert.equal(metricsSearchContent.includes('onKeyDown={handleKeyDown}'), true)
})
