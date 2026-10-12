import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('TimeInput component enforces accessibility attributes and focus protection', () => {
  const filePath = path.join(process.cwd(), 'components/daily-log/time-input.tsx')
  const code = fs.readFileSync(filePath, 'utf8')

  // Check input aria-label
  assert.ok(
    code.includes('aria-label={label || \'Time input\'}'),
    'TimeInput should supply an aria-label for the text input'
  )

  // Check quick increment/decrement aria-labels and preventDefault
  assert.ok(
    code.includes('aria-label="Add 1 minute"'),
    'TimeInput should supply an aria-label for the +1m button'
  )
  assert.ok(
    code.includes('aria-label="Subtract 1 minute"'),
    'TimeInput should supply an aria-label for the -1m button'
  )
  assert.ok(
    code.includes('onMouseDown={(e) => e.preventDefault()}'),
    'TimeInput helper buttons should prevent default on mouse down to preserve input focus'
  )

  // Check clear button aria-label
  assert.ok(
    code.includes('aria-label="Clear time input"'),
    'TimeInput clear button should supply an aria-label'
  )
})
