import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('MetricsSearch includes accessibility attributes and explicit clear button type', () => {
  const fileContent = read('components/metrics/metrics-search.tsx')

  assert.equal(fileContent.includes('aria-label="Search metrics"'), true, 'Input should have aria-label="Search metrics"')
  assert.equal(fileContent.includes('aria-label="Clear search"'), true, 'Clear button should have aria-label="Clear search"')
  assert.equal(fileContent.includes('type="button"'), true, 'Clear button should explicitly set type="button"')
})
