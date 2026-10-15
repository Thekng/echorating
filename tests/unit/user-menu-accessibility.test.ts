import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('UserMenu wraps logout button in DropdownMenuItem asChild for menu keyboard accessibility', () => {
  const userMenuContent = read('components/layout/user-menu.tsx')

  // Verify trigger button has explicit aria-label for screen readers
  assert.equal(userMenuContent.includes('aria-label={`User menu for ${userName || userEmail || \'User\'}`}'), true)

  // Verify logout button is wrapped in DropdownMenuItem asChild for Radix UI focus/keyboard navigation
  assert.equal(
    userMenuContent.includes(
      '<DropdownMenuItem asChild>\n            <button type="submit"',
    ) || userMenuContent.includes('<DropdownMenuItem asChild>'),
    true,
  )
})
