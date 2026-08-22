import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('metrics search component implements accessibility attributes and clear button standards', () => {
  const content = read('components/metrics/metrics-search.tsx')

  // Accessible input attributes
  assert.equal(content.includes('aria-label={placeholder}'), true)
  assert.equal(content.includes('aria-expanded={isOpen}'), true)
  assert.equal(content.includes('aria-controls="metrics-search-listbox"'), true)

  // Accessible clear button
  assert.equal(content.includes('type="button"'), true)
  assert.equal(content.includes('aria-label="Clear search"'), true)
  assert.equal(content.includes('title="Clear search"'), true)

  // Accessible listbox and option roles
  assert.equal(content.includes('role="listbox"'), true)
  assert.equal(content.includes('role="option"'), true)
  assert.equal(content.includes('id="metrics-search-listbox"'), true)

  // Focus visible rings
  assert.equal(content.includes('focus-visible:ring-2'), true)
})
