import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

test('TimeInput component implements accessibility and UX standards', () => {
  const filePath = path.join(process.cwd(), 'components/daily-log/time-input.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Check useId hook import and usage
  assert.match(content, /import \{ [^}]*useId[^}]* \} from 'react'/)
  assert.match(content, /htmlFor=\{inputId\}/)
  assert.match(content, /id=\{inputId\}/)

  // Check aria-label on quick increment / decrement / clear buttons
  assert.match(content, /aria-label="Add 1 minute"/)
  assert.match(content, /aria-label="Subtract 1 minute"/)
  assert.match(content, /aria-label="Clear time input"/)

  // Check focus retention on button click (onMouseDown preventDefault)
  assert.match(content, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/)

  // Check focus-visible focus ring styling
  assert.match(content, /focus-visible:ring-1/)
})
