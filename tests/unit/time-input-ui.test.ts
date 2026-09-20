import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput component connects label and input with htmlFor and id', () => {
  const timeInputFile = read('components/daily-log/time-input.tsx')

  assert.equal(timeInputFile.includes('htmlFor={inputId}'), true)
  assert.equal(timeInputFile.includes('id={inputId}'), true)
  assert.equal(timeInputFile.includes('useId()'), true)
})

test('TimeInput helper buttons include ARIA labels and prevent focus loss on mouse down', () => {
  const timeInputFile = read('components/daily-log/time-input.tsx')

  assert.equal(timeInputFile.includes('aria-label="Add 1 minute"'), true)
  assert.equal(timeInputFile.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(timeInputFile.includes('aria-label="Clear time input"'), true)
  assert.equal(timeInputFile.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})

test('TimeInput synchronizes state without useEffect to prevent cascading renders', () => {
  const timeInputFile = read('components/daily-log/time-input.tsx')

  // Check that value !== prevValue derived state pattern is used
  assert.equal(timeInputFile.includes('if (value !== prevValue)'), true)
})
