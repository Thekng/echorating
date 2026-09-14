import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('DailyLogForm associates labels and inputs with explicit metric IDs and uses statusText', () => {
  const formCode = read('components/daily-log/daily-log-form.tsx')

  // Verify label htmlFor and id associations
  assert.equal(formCode.includes('htmlFor={`metric-${metric.id}`}'), true)
  assert.equal(formCode.includes('id={`metric-label-${metric.id}`}'), true)

  // Verify metric input fieldId assignment
  assert.equal(formCode.includes('const fieldId = `metric-${metric.id}`'), true)
  assert.equal(formCode.includes('id={fieldId}'), true)

  // Verify radio group role and aria-labelledby attribute
  assert.equal(formCode.includes('role="radiogroup"'), true)
  assert.equal(formCode.includes('aria-labelledby={`metric-label-${metric.id}`}'), true)

  // Verify direct use of statusText instead of inline ternary duplication
  assert.equal(formCode.includes('{statusText}'), true)
})
