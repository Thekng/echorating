import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('DailyLogForm metric inputs have proper label htmlFor associations', () => {
  const dailyLogForm = read('components/daily-log/daily-log-form.tsx')

  assert.equal(dailyLogForm.includes('htmlFor={inputId}'), true)
  assert.equal(dailyLogForm.includes('id={inputId}'), true)
})

test('DailyLogForm toast container has accessible status live region', () => {
  const dailyLogForm = read('components/daily-log/daily-log-form.tsx')

  assert.equal(dailyLogForm.includes('role="status"'), true)
  assert.equal(dailyLogForm.includes('aria-live="polite"'), true)
})
