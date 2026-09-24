import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput implements accessibility best practices and focus preservation', () => {
  const timeInputCode = read('components/daily-log/time-input.tsx')

  // Label HTML linkage
  assert.equal(timeInputCode.includes('htmlFor={inputId}'), true)
  assert.equal(timeInputCode.includes('id={inputId}'), true)

  // ARIA labels for icon-only action buttons
  assert.equal(timeInputCode.includes('aria-label="Add 1 minute"'), true)
  assert.equal(timeInputCode.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(timeInputCode.includes('aria-label="Clear time input"'), true)

  // Focus preservation via onMouseDown
  assert.equal(timeInputCode.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})
