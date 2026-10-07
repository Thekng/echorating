import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

test('UserMenu has aria-label and uses DropdownMenuItem for logout', () => {
  const filePath = path.join(process.cwd(), 'components/layout/user-menu.tsx')
  const content = fs.readFileSync(filePath, 'utf-8')

  assert.ok(
    content.includes('aria-label="User menu"'),
    'UserMenu trigger button should have aria-label="User menu"'
  )

  assert.ok(
    content.includes('<DropdownMenuItem asChild>'),
    'UserMenu should wrap interactive items in DropdownMenuItem asChild'
  )
})
