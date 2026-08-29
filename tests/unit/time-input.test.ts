import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput component has proper ARIA labels, label-input association, and focus-visible styling', () => {
  const timeInputSource = read('components/daily-log/time-input.tsx')

  // Label to input association
  assert.equal(timeInputSource.includes('htmlFor={inputId}'), true)
  assert.equal(timeInputSource.includes('id={inputId}'), true)

  // ARIA labels for buttons
  assert.equal(timeInputSource.includes('aria-label="Add 1 minute"'), true)
  assert.equal(timeInputSource.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(timeInputSource.includes('aria-label="Clear time input"'), true)

  // Keyboard focus styling
  assert.equal(timeInputSource.includes('focus-visible:ring-1'), true)
})
