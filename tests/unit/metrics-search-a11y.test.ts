import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('metrics search input component implements combobox and accessible controls', () => {
  const content = read('components/metrics/metrics-search.tsx')

  assert.equal(content.includes('role="combobox"'), true)
  assert.equal(content.includes('role="listbox"'), true)
  assert.equal(content.includes('role="option"'), true)
  assert.equal(content.includes('aria-label="Clear search input"'), true)
  assert.equal(content.includes('aria-controls="metrics-search-results"'), true)
})
