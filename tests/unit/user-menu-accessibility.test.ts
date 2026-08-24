import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('UserMenu wraps logout form submit button in DropdownMenuItem asChild', () => {
  const filePath = path.join(process.cwd(), 'components/layout/user-menu.tsx')
  const content = fs.readFileSync(filePath, 'utf8')

  // Verify that <DropdownMenuItem asChild> wraps the button inside the logout form
  const formLogoutPattern = /<form action={signOutAction}>\s*<DropdownMenuItem asChild>\s*<button type="submit"/

  assert.ok(
    formLogoutPattern.test(content),
    'UserMenu component should wrap the logout form button in <DropdownMenuItem asChild>'
  )
})
