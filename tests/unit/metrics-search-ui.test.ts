import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('MetricsSearch component implements ARIA combobox pattern and keyboard navigation', () => {
  const filePath = path.join(process.cwd(), 'components/metrics/metrics-search.tsx')
  const code = fs.readFileSync(filePath, 'utf-8')

  assert.ok(code.includes('role="combobox"'), 'Input should have role="combobox"')
  assert.ok(code.includes('aria-expanded='), 'Input should set aria-expanded')
  assert.ok(code.includes('aria-controls="metrics-search-listbox"'), 'Input should set aria-controls')
  assert.ok(code.includes('role="listbox"'), 'Dropdown list should have role="listbox"')
  assert.ok(code.includes('role="option"'), 'Options should have role="option"')
  assert.ok(code.includes('aria-selected='), 'Options should set aria-selected')
  assert.ok(code.includes('onKeyDown={handleKeyDown}'), 'Input should handle keyboard navigation')
  assert.ok(code.includes('aria-label="Clear search query"'), 'Clear button should have descriptive aria-label')
})
