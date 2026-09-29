import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput component enforces accessibility attributes and focus management', () => {
  const content = read('components/daily-log/time-input.tsx')

  // Label and input association
  assert.equal(content.includes('htmlFor={inputId}'), true)
  assert.equal(content.includes('id={inputId}'), true)

  // ARIA labels for icon/text buttons
  assert.equal(content.includes('aria-label="Add 1 minute"'), true)
  assert.equal(content.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(content.includes('aria-label="Clear time input"'), true)

  // Prevent focus theft on action buttons
  assert.equal(content.includes('onMouseDown={(e) => e.preventDefault()}'), true)

  // Error state accessibility
  assert.equal(content.includes('aria-invalid={!!error}'), true)

  // State synchronization pattern avoids setState in useEffect
  assert.equal(content.includes('if (value !== prevValue)'), true)
})
