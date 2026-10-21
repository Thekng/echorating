import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch includes accessibility attributes and keyboard event handlers', () => {
  const filePath = path.join(process.cwd(), 'components/metrics/metrics-search.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.match(content, /aria-label="Search metrics"/)
  assert.match(content, /aria-label="Clear search"/)
  assert.match(content, /type="button"/)
  assert.match(content, /e\.key === 'Escape'/)
  assert.match(content, /focus-visible:ring-2/)
})
