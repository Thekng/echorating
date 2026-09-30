import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput buttons include ARIA labels and focus retention handlers', () => {
  const code = read('components/daily-log/time-input.tsx')

  assert.equal(code.includes('aria-label="Add 1 minute"'), true)
  assert.equal(code.includes('aria-label="Subtract 1 minute"'), true)
  assert.equal(code.includes('aria-label="Clear time"'), true)
  assert.equal(code.includes('onMouseDown={(e) => e.preventDefault()}'), true)
})
