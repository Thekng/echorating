import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function read(relativePath: string) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

test('UserMenu wraps logout button with DropdownMenuItem asChild for accessibility', () => {
  const userMenu = read('components/layout/user-menu.tsx')

  assert.equal(userMenu.includes('<DropdownMenuItem asChild>'), true)
  assert.equal(userMenu.includes('button type="submit"'), true)
})
