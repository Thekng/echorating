import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput component incorporates focus prevention and ARIA labels on quick action buttons', () => {
  const timeInputContent = read('components/daily-log/time-input.tsx')

  // Check decorative icon hiding
  assert.equal(timeInputContent.includes('aria-hidden="true"'), true)

  // Check aria-labels on action buttons
  assert.equal(timeInputContent.includes('aria-label="Add 1 minute"'), true)
  assert.equal(timeInputContent.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(timeInputContent.includes('aria-label="Clear time input"'), true)

  // Check onMouseDown preventDefault focus retention pattern
  assert.equal(timeInputContent.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})
