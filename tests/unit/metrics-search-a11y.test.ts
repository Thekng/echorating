import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('MetricsSearch includes accessibility attributes, roles, and ARIA labels', () => {
  const content = read('components/metrics/metrics-search.tsx')

  assert.equal(content.includes('role="combobox"'), true)
  assert.equal(content.includes('aria-label="Search metrics"'), true)
  assert.equal(content.includes('aria-label="Clear search"'), true)
  assert.equal(content.includes('aria-expanded={isOpen}'), true)
  assert.equal(content.includes('role="listbox"'), true)
  assert.equal(content.includes('role="option"'), true)
  assert.equal(content.includes('aria-selected={false}'), true)
  assert.equal(content.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})
