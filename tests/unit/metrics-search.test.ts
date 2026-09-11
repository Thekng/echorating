import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch includes proper ARIA labels and handles keyboard events', () => {
  const filePath = path.join(process.cwd(), 'components/metrics/metrics-search.tsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  // Check aria-label on input
  assert.ok(content.includes('aria-label="Search metrics"'), 'Search input should have aria-label="Search metrics"')

  // Check aria-label on clear button
  assert.ok(content.includes('aria-label="Clear search"'), 'Clear button should have aria-label="Clear search"')

  // Check onKeyDown handler
  assert.ok(content.includes('onKeyDown='), 'Search input should have onKeyDown handler for Enter key')
})
