import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('TimeInput implements label association, aria-label attributes, and focus theft prevention', () => {
  const content = read('components/daily-log/time-input.tsx')

  // Verify label-input association
  assert.equal(content.includes('htmlFor={inputId}'), true, 'label should use htmlFor={inputId}')
  assert.equal(content.includes('id={inputId}'), true, 'input should use id={inputId}')

  // Verify ARIA labels on action buttons
  assert.equal(content.includes('aria-label="Add 1 minute"'), true, '+1m button should have aria-label')
  assert.equal(content.includes('aria-label="Subtract 1 minute"'), true, '-1m button should have aria-label')
  assert.equal(content.includes('aria-label="Clear time"'), true, 'clear button should have aria-label')

  // Verify focus theft prevention on mouse down
  assert.equal(content.includes('onMouseDown={(e) => e.preventDefault()}'), true, 'buttons should prevent default on mouse down')
})
