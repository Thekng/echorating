import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch includes combobox and listbox accessibility attributes', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/metrics/metrics-search.tsx'),
    'utf8'
  )

  assert.match(source, /role="combobox"/, 'Input should have role="combobox"')
  assert.match(source, /aria-expanded=\{isOpen\}/, 'Input should bind aria-expanded state')
  assert.match(source, /aria-controls="metrics-search-listbox"/, 'Input should specify aria-controls')
  assert.match(source, /role="listbox"/, 'Results container should have role="listbox"')
  assert.match(source, /role="option"/, 'Result buttons should have role="option"')
  assert.match(source, /aria-label="Clear search query"/, 'Clear button should have descriptive aria-label')
  assert.match(source, /e\.key === 'Escape'/, 'Keydown listener should handle Escape key to close popup')
})
