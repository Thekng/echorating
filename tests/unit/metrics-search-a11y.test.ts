import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch implements required accessibility attributes', () => {
  const filePath = path.join(process.cwd(), 'components/metrics/metrics-search.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Check search input has aria-label
  assert.ok(
    content.includes('aria-label="Search metrics"'),
    'Search input should have explicit aria-label'
  )

  // Check clear button has aria-label and type="button"
  assert.ok(
    content.includes('aria-label="Clear search"'),
    'Clear search button should have explicit aria-label'
  )
  assert.ok(
    content.includes('type="button"'),
    'Interactive buttons should explicitly set type="button"'
  )

  // Check empty search feedback has role="status" and aria-live="polite"
  assert.ok(
    content.includes('role="status"'),
    'Empty results container should have role="status"'
  )
  assert.ok(
    content.includes('aria-live="polite"'),
    'Empty results container should have aria-live="polite"'
  )

  // Check focus ring indicator classes are present
  assert.ok(
    content.includes('focus-visible:ring-2'),
    'Interactive elements should include keyboard focus visible rings'
  )
})
