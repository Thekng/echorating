import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch component defines proper ARIA roles and labels', () => {
  const filePath = path.join(process.cwd(), 'components', 'metrics', 'metrics-search.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.match(content, /aria-label="Clear search"/, 'Clear button should have descriptive aria-label')
  assert.match(content, /role="combobox"/, 'Search input should have role="combobox"')
  assert.match(content, /aria-autocomplete="list"/, 'Search input should specify aria-autocomplete="list"')
  assert.match(content, /role="listbox"/, 'Results container should have role="listbox"')
  assert.match(content, /role="option"/, 'Dropdown items should have role="option"')
  assert.match(content, /aria-selected=\{false\}/, 'Dropdown items should explicitly include aria-selected attribute')
})
