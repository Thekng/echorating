import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('TimeInput component accessibility and focus UX', () => {
  const filePath = path.join(process.cwd(), 'components/daily-log/time-input.tsx')
  const code = fs.readFileSync(filePath, 'utf8')

  // Label and input association
  assert.ok(code.includes('htmlFor={inputId}'), 'TimeInput label should link to input via htmlFor={inputId}')
  assert.ok(code.includes('id={inputId}'), 'TimeInput input should specify id={inputId}')

  // ARIA labels for buttons
  assert.ok(code.includes('aria-label="Add 1 minute"'), 'Increment button should have aria-label')
  assert.ok(code.includes('aria-label="Subtract 1 minute"'), 'Decrement button should have aria-label')
  assert.ok(code.includes('aria-label="Clear time input"'), 'Clear button should have aria-label')

  // Focus preservation using onMouseDown preventDefault
  assert.ok(code.includes('onMouseDown={(e) => e.preventDefault()}'), 'Buttons should prevent default on mouse down to keep focus on input')
})
