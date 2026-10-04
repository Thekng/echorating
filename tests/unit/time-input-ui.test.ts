import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput component incorporates accessible labels, ARIA attributes, and focus preservation', () => {
  const content = read('components/daily-log/time-input.tsx')

  // Label and ID association
  assert.equal(content.includes('htmlFor={inputId}'), true)
  assert.equal(content.includes('id={inputId}'), true)

  // ARIA labels for buttons
  assert.equal(content.includes('aria-label="Add 1 minute"'), true)
  assert.equal(content.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(content.includes('aria-label="Clear time input"'), true)

  // Focus preservation via onMouseDown
  assert.equal(content.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})
