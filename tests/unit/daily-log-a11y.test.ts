import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('DailyLogForm implements accessible label-input associations and radiogroup roles', () => {
  const formContent = read('components/daily-log/daily-log-form.tsx')
  const durationContent = read('components/daily-log/duration-selector.tsx')

  // Check label has id and conditional htmlFor
  assert.equal(formContent.includes('id={`metric-label-${metric.id}`}'), true)
  assert.equal(formContent.includes('htmlFor={isRadio ? undefined : `metric-${metric.id}`}'), true)

  // Check inputs have id={`metric-${metric.id}`}
  assert.equal(formContent.includes('id={`metric-${metric.id}`}'), true)

  // Check radio selection mode has radiogroup role and aria-labelledby
  assert.equal(formContent.includes('role="radiogroup"'), true)
  assert.equal(formContent.includes('aria-labelledby={`metric-label-${metric.id}`}'), true)

  // Check DurationSelector supports optional id
  assert.equal(durationContent.includes('id?: string'), true)
  assert.equal(durationContent.includes('id={id}'), true)
})
