import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput component includes required ARIA labels and focus prevention', () => {
  const timeInputContent = read('components/daily-log/time-input.tsx')

  // Check ARIA labels for buttons
  assert.equal(timeInputContent.includes('aria-label="Add 1 minute"'), true)
  assert.equal(timeInputContent.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(timeInputContent.includes('aria-label="Clear time input"'), true)

  // Check onMouseDown focus prevention
  assert.equal(timeInputContent.includes('onMouseDown={(e) => e.preventDefault()}'), true)

  // Check derived state pattern is used instead of useEffect for value sync
  assert.equal(timeInputContent.includes('if (value !== prevValue)'), true)
})
