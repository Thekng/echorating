import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch component contains proper accessibility attributes', () => {
  const filePath = path.join(process.cwd(), 'components/metrics/metrics-search.tsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  assert.ok(
    content.includes('aria-label="Clear search"'),
    'MetricsSearch clear button should have an aria-label="Clear search"'
  )
  assert.ok(
    content.includes('role="combobox"'),
    'MetricsSearch input should have role="combobox"'
  )
  assert.ok(
    content.includes('aria-expanded={isOpen}'),
    'MetricsSearch input should indicate expansion state with aria-expanded'
  )
  assert.ok(
    content.includes('aria-autocomplete="list"'),
    'MetricsSearch input should indicate autocomplete mode with aria-autocomplete="list"'
  )
})
