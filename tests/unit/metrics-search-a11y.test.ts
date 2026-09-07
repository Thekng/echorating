import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch clear button includes accessibility attributes and focus protection', () => {
  const filePath = path.join(process.cwd(), 'components/metrics/metrics-search.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Check clear button attributes
  assert.match(content, /type="button"/, 'Clear button should have explicit type="button"')
  assert.match(content, /aria-label="Clear search"/, 'Clear button should have aria-label')
  assert.match(content, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/, 'Clear button should prevent focus steal on mouse down')
})
