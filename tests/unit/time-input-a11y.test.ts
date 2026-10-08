import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput source code contains accessibility and focus preservation attributes', () => {
  const content = read('components/daily-log/time-input.tsx')

  // Verify label association
  assert.equal(content.includes('htmlFor={inputId}'), true)
  assert.equal(content.includes('id={inputId}'), true)

  // Verify ARIA labels for buttons
  assert.equal(content.includes('aria-label="Add 1 minute"'), true)
  assert.equal(content.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(content.includes('aria-label="Clear time"'), true)

  // Verify onMouseDown focus preservation
  assert.equal(content.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})
