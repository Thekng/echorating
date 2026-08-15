import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

test('TimeInput component source code includes accessibility attributes', () => {
  const filePath = path.join(process.cwd(), 'components/daily-log/time-input.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Label and input association
  assert.ok(content.includes('htmlFor={inputId}'), 'Label should have htmlFor attribute linked to inputId')
  assert.ok(content.includes('id={inputId}'), 'Input should have id attribute linked to inputId')

  // ARIA attributes for error handling
  assert.ok(content.includes('aria-invalid={!!error}'), 'Input should set aria-invalid based on error prop')
  assert.ok(
    content.includes('aria-describedby={error ? errorId : undefined}'),
    'Input should set aria-describedby referencing error message ID when error is present'
  )

  // ARIA labels on action buttons
  assert.ok(content.includes('aria-label="Add 1 minute"'), 'Increment button (+1m) should have explicit aria-label')
  assert.ok(content.includes('aria-label="Subtract 1 minute"'), 'Decrement button (-1m) should have explicit aria-label')
  assert.ok(content.includes('aria-label="Clear time input"'), 'Clear button should have explicit aria-label')
})
