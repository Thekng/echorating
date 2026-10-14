import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('TimeInput source code contains required accessibility and focus features', () => {
  const filePath = path.join(process.cwd(), 'components/daily-log/time-input.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Check label/input association
  assert.ok(content.includes('htmlFor={inputId}'), 'Label must have htmlFor attribute pointing to inputId')
  assert.ok(content.includes('id={inputId}'), 'Input must have id attribute set to inputId')

  // Check explicit ARIA labels on buttons
  assert.ok(content.includes('aria-label="Add 1 minute"'), 'Increment button must have explicit aria-label')
  assert.ok(content.includes('aria-label="Subtract 1 minute"'), 'Decrement button must have explicit aria-label')
  assert.ok(content.includes('aria-label="Clear time input"'), 'Clear button must have explicit aria-label')

  // Check onMouseDown focus prevention
  assert.ok(content.includes('onMouseDown={(e) => e.preventDefault()}'), 'Buttons must prevent focus loss on mouse down')
})
