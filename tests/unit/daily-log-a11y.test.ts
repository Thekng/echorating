import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('daily log form associates labels with inputs and configures radiogroup accessibility', () => {
  const formCode = read('components/daily-log/daily-log-form.tsx')

  assert.equal(formCode.includes('htmlFor={isRadio ? undefined : inputId}'), true)
  assert.equal(formCode.includes('id={labelId}'), true)
  assert.equal(formCode.includes('role="radiogroup"'), true)
  assert.equal(formCode.includes('aria-labelledby={`metric-label-${metric.id}`}'), true)
})
