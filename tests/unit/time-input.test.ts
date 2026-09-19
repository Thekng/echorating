import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput component links label to input via htmlFor and id', () => {
  const content = read('components/daily-log/time-input.tsx')

  assert.equal(content.includes('htmlFor={inputId}'), true)
  assert.equal(content.includes('id={inputId}'), true)
  assert.equal(content.includes('useId()'), true)
})

test('TimeInput quick adjustment and clear buttons have aria-labels and prevent default on mousedown', () => {
  const content = read('components/daily-log/time-input.tsx')

  assert.equal(content.includes('aria-label="Add 1 minute"'), true)
  assert.equal(content.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(content.includes('aria-label="Clear time input"'), true)
  assert.equal(content.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})

test('TimeInput uses derived state instead of useEffect for value synchronization', () => {
  const content = read('components/daily-log/time-input.tsx')

  assert.equal(content.includes('useEffect'), false)
  assert.equal(content.includes('if (value !== prevValue)'), true)
})
