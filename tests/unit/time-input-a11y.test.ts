import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput component has accessibility labels, id associations, and focus-prevention on buttons', () => {
  const fileContent = read('components/daily-log/time-input.tsx')

  // Check for id and htmlFor linkage
  assert.equal(fileContent.includes('htmlFor={inputId}'), true)
  assert.equal(fileContent.includes('id={inputId}'), true)

  // Check for ARIA labels on action buttons
  assert.equal(fileContent.includes('aria-label="Add 1 minute"'), true)
  assert.equal(fileContent.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(fileContent.includes('aria-label="Clear time input"'), true)

  // Check for onMouseDown e.preventDefault() on buttons to prevent focus loss
  assert.equal(fileContent.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})
