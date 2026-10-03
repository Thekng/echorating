import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput includes accessibility attributes and preserves input focus', () => {
  const content = read('components/daily-log/time-input.tsx')

  // Label & Input linking
  assert.equal(content.includes('htmlFor={id}'), true)
  assert.equal(content.includes('id={id}'), true)

  // ARIA attributes for descriptions & error state
  assert.equal(content.includes('aria-describedby={error ? errorId : helpId}'), true)
  assert.equal(content.includes('aria-invalid={!!error}'), true)

  // ARIA labels for icon/symbol buttons
  assert.equal(content.includes('aria-label="Add 1 minute"'), true)
  assert.equal(content.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(content.includes('aria-label="Clear time input"'), true)

  // Focus preservation on button clicks
  assert.equal(content.includes('onMouseDown={(e) => e.preventDefault()}'), true)

  // Derived state pattern instead of useEffect for state sync
  assert.equal(content.includes('if (value !== prevValue)'), true)
})
