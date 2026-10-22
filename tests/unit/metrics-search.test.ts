import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('metrics search component implements accessibility ARIA attributes and Escape key handling', () => {
  const content = read('components/metrics/metrics-search.tsx')

  // Accessible input label
  assert.equal(content.includes('aria-label={placeholder}'), true)

  // Clear button accessibility
  assert.equal(content.includes('aria-label="Clear search"'), true)
  assert.equal(content.includes('type="button"'), true)

  // Empty state screen reader notification
  assert.equal(content.includes('role="status"'), true)
  assert.equal(content.includes('aria-live="polite"'), true)

  // Dismissal key handler
  assert.equal(content.includes("event.key === 'Escape'"), true)
})
