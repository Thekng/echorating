import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('metrics search component includes accessibility labels and attributes', () => {
  const filePath = path.join(process.cwd(), 'components/metrics/metrics-search.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  assert.match(content, /aria-label="Clear search"/)
  assert.match(content, /aria-expanded=\{isOpen\}/)
  assert.match(content, /aria-autocomplete="list"/)
  assert.match(content, /type="button"/)
})
