import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput uses derived state sync and includes accessible control buttons', () => {
  const timeInputContent = read('components/daily-log/time-input.tsx')

  // Check state-in-effect is avoided using derived state pattern
  assert.equal(timeInputContent.includes('if (value !== prevValue)'), true)
  assert.equal(timeInputContent.includes('setPrevValue(value)'), true)

  // Check buttons preserve focus and have ARIA labels
  assert.equal(timeInputContent.includes('onMouseDown={(e) => e.preventDefault()}'), true)
  assert.equal(timeInputContent.includes('aria-label="Add 1 minute"'), true)
  assert.equal(timeInputContent.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(timeInputContent.includes('aria-label="Clear time"'), true)
})
