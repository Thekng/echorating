import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch includes accessibility ARIA attributes', () => {
  const filePath = path.join(process.cwd(), 'components/metrics/metrics-search.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.ok(
    content.includes('aria-label="Clear search"'),
    'MetricsSearch should contain aria-label="Clear search" for the clear button'
  )
  assert.ok(
    content.includes('role="combobox"'),
    'MetricsSearch input should have role="combobox"'
  )
  assert.ok(
    content.includes('aria-expanded={isOpen}'),
    'MetricsSearch input should specify aria-expanded'
  )
  assert.ok(
    content.includes('aria-label="Search metrics"'),
    'MetricsSearch input should specify aria-label="Search metrics"'
  )
})
