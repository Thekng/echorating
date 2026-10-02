import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('TimeInput component includes required ARIA attributes and focus prevention handlers', () => {
  const filePath = path.join(process.cwd(), 'components/daily-log/time-input.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Check for aria-invalid on input
  assert.ok(
    content.includes('aria-invalid={Boolean(error)}'),
    'TimeInput should pass aria-invalid boolean state based on error'
  )

  // Check for aria-label on main input
  assert.ok(
    content.includes("aria-label={label || 'Time input'}"),
    'TimeInput should pass an aria-label to the text input'
  )

  // Check for onMouseDown preventDefault on increment buttons
  assert.ok(
    content.includes('onMouseDown={(e) => e.preventDefault()}'),
    'TimeInput quick action buttons should prevent default on mouse down to retain input focus'
  )

  // Check for aria-label on quick action buttons
  assert.ok(
    content.includes('aria-label="Add 1 minute"'),
    'Add 1 minute button should specify aria-label'
  )
  assert.ok(
    content.includes('aria-label="Subtract 1 minute"'),
    'Subtract 1 minute button should specify aria-label'
  )
  assert.ok(
    content.includes('aria-label="Clear time"'),
    'Clear button should specify aria-label'
  )
})
